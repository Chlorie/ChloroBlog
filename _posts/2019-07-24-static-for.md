---
layout: post
categories: posts
title: 求你展开这个循环吧
subtitle: a.k.a. 如何滥用C++模板(1)
tags: [C++, TMP, 模板]
date-string: 2019-07-24
---
这个纯属是前一段时间的谜之脑洞，因为当时是想采用RL的方法训练对立的黑白棋的，不过我总是在各种地方出问题，导致最后这个想法并没有实现。不过当时还是有一些奇妙的想法，比如说循环展开。虽然说Donald Knuth说过，[为时过早的优化是编程中所有（至少大部分）邪恶的起源](https://en.wikiquote.org/wiki/Donald_Knuth)，而且我当时写的代码也完全没有到需要展开循环才能够优化的程度，因为算法本身的复杂度就已经非常高了，这样做其实并没有太大的实际意义，但因为本人对C++的TMP有着谜之执念，我最后还是试图用这种方法提高一丁点运行效率。

大家都知道现代的编译器一个比一个聪明，cppcon上Gor Nishanov甚至还向大家展示了一个C++20的协程被编译器直接内联而连同其动态内存分配一起消失的编译器神操作（[看这里](https://www.youtube.com/watch?v=8C8NnE1Dg4A)），让我对编译器（尤其是clang）作者充满了敬佩。不过以微软一直以来的风格，有些事情一到了微软这边就会出现奇怪的现象。不要误会我，Visual Studio真的好用，但是他们的编译器cl.exe在有些优化操作上确实是不太行，就比如这篇文章要说的循环展开问题。举个例子吧，比如下面这一段代码：

```cpp
void func();
void test()
{
    for (size_t i = 0; i < 4; i++)
        func();
}
```

很简单不是吗？在[Compiler Explorer](https://godbolt.org/)上面用gcc和clang编译（优化开关为`-O2`）的结果是一致的：因为循环的次数在编译期就已经知道了，并且这个数字根本就不大，所以优化器直接舍弃了循环，节省了每次自增以及比较的时间。这件事情可以通过看clang编译出的汇编来验证（gcc也有类似的结果）。看看人家，甚至都把尾部调用的`call`指令优化成了一个简单的`jmp`：

```nasm
test():                               # @test()
        push    rax
        call    func()
        call    func()
        call    func()
        pop     rax
        jmp     func()                # TAILCALL
```

那我们的MSVC编译器表现如何呢？让我们看一下汇编（优化开关`/O2`）：

```nasm
void test(void) PROC                  ; test, COMDAT
$LN11:
        push    rbx
        sub     rsp, 32               ; 00000020H
        mov     ebx, 4
        npad    5
$LL4@test:
        call    void func(void)       ; func
        sub     rbx, 1
        jne     SHORT $LL4@test
        add     rsp, 32               ; 00000020H
        pop     rbx
        ret     0
void test(void) ENDP                  ; test
```

搞什么啊！（掀桌）总之我的心灵被震撼了。MSVC果然还是MSVC，没让我失望。于是我就开始想别(template)的(meta-)辙(programming)。这编译器虽然不给我展开循环，但是至少它的函数内联优化还是起作用的，所以，如果我强行让编译器把我想循环的那一段代码“复制”几遍呢？

当然，我要的API绝对不能很难看。这种复制粘贴代码的事情按理来说是预处理器最在行的事情，但是我终究还是不想使用宏。我构想的API大致是这样的，在模板参数中指定循环次数，并给这个函数传递一个要循环的函数对象。下面的例子还使用了`func`，不过这里我希望传递lambda也应该可行。

```cpp
void test() { repeat<4>(func); }
```

这件事不难嘛，说干就干！一般来讲，这种事情我们可以采用模板特化的技巧来实现，让编译器递归地展开这些函数调用：

```cpp
template <size_t N, typename F>
void repeat(F f)
{
    f();
    repeat<N - 1>(f);
}

template <typename F>
void repeat<0, F>(F f);
```

等会，函数模板是不能偏特化的，所以这里面的函数特化是非法的，我们需要一个辅助结构帮我们做这件事。顺便，为了不复制很多份可能比较大的函数对象，我们最好还是用完美转发来传递这个函数。

```cpp
namespace detail
{
    template <size_t N>
    struct RepeatHelper final
    {
        template <typename F>
        static void impl(F&& f)
        {
            f();
            RepeatHelper<N - 1>::impl(std::forward<F>(f));
        }
    };

    template <>
    struct RepeatHelper<0> final // End of recursion
    {
        template <typename F>
        static void impl(F&&) {}
    };
}

template <size_t N, typename F>
void repeat(F&& f) { detail::RepeatHelper<N>::impl(std::forward<F>(f)); }
```

这样，我们就把循环转化成了一个静态深度的递归，如果编译器把这些调用都内联的话，我们就应该可以获得想要的效果了。把这段代码用gcc和clang编译，我们得到的当然还是同样的输出。看一看MSVC现在的输出吧！

```nasm
void test(void) PROC                  ; test, COMDAT
$LN27:
        sub     rsp, 40               ; 00000028H
        call    void func(void)       ; func
        call    void func(void)       ; func
        call    void func(void)       ; func
        add     rsp, 40               ; 00000028H
        jmp     void func(void)       ; func
void test(void) ENDP                  ; test
```

我们的目标达成了！

不过这里隐藏着另外一个问题：虽然编译器可以比较轻松地优化掉这些递归调用，但是它还是需要实例化出很多的函数，这样的线性递归就导致这种循环展开方法的（编译时）复杂度是\\(O(n)\\)的。为了给我们辛苦工作的编译器减负，我们需要更好的算法。这里，不用线性复杂度的递归，采用对数复杂度的方法的话，就可以一定程度上解决这个问题。

```cpp
namespace detail
{
    template <size_t N>
    struct RepeatHelper final
    {
        template <typename F>
        static void impl(F&& f)
        {
            if constexpr (N % 2) f();
            RepeatHelper<N / 2>::impl(std::forward<F>(f));
            RepeatHelper<N / 2>::impl(std::forward<F>(f));
        }
    };

    template <>
    struct RepeatHelper<0> final // End of recursion
    {
        template <typename F>
        static void impl(F&&) {}
    };

    template <>
    struct RepeatHelper<1> final // End of recursion
    {
        template <typename F>
        static void impl(F&& f) { f(); }
    };
}
```

这样，我们就把时间复杂度从\\(O(n)\\)降到了\\(O\left(\log_2(n)\right)\\)。事实上，clang之前的`std::index_sequence`生成算法就用了这种思想，不过其实现是\\(O\left(\log_8(n)\right)\\)的，虽然大O表示是等价的，但实际使用时因为常数更小，编译时间还是有一定差别的。用MSVC编译器编译出的结果跟前面的方法是一致的。（其实这里我写的代码存在一个问题，如果`F`被推导成右值引用的话，连续两次调用`std::forward`有可能会造成移动后使用(use after move)的问题。不过后面有比这更好的解法，所以也就不要在意这些细节了。）

前面说到`std::index_sequence`，如果能使用这个辅助类，再用上折叠表达式，我们可以把如何生成长度n的序列的问题直接交给STL，因为STL有可能还会调用一些编译器的内置指令，其效率肯定是要比手动展开快的。这里我们要用到C++17的折叠表达式特性。

```cpp
namespace detail
{
    template <typename F, size_t... I>
    void repeat_impl(F&& f, std::index_sequence<I...>)
    {
        ((void(I), f()), ...);
    }
}

template <size_t N, typename F>
void repeat(F&& f) 
{ 
    detail::repeat_impl(std::forward<F>(f), std::make_index_sequence<N>{}); 
}
```

这样前面的函数`test`编译出的结果是跟以前完全一致的，并且编译器生成的函数数量也大大减少了，效率比之前的方法都要高。在这里，这种使用`std::index_sequence`生成编译时下标序列的方法是在TMP中经常用到的，各位还是需要适应这种写法。在这里我还是举例说明一下这段代码的运作流程。当我们调用`repeat<4>(func)`时：

1. 用户提供了函数模板`repeat`的第一个模板参数`N = 4`，而根据模板形参推导(TAD)的规则，可以根据传递的参数`func`的类型推导出`repeat`的第二个模板参数`F = void(*)()`即函数指针`func`的类型。
2. 将这些模板形参代入，这样`repeat`的函数体就相当于执行了以下的语句：
```cpp
detail::repeat_impl(std::forward<void(*)()>(func), std::make_index_sequence<4>{});
```
3. 因为转发函数指针实际上就是直接值传递，并且根据`std::make_index_sequence`的作用，我们知道上面的语句等价于：
```cpp
detail::repeat_impl(func, std::index_sequence<0, 1, 2, 3>{});
```
4. 根据TAD规则，可以推导出`detail::repeat_impl`这里的模板形参为`F = void(*)()`以及`I... = 0, 1, 2, 3`。
5. 将这些模板形参代入，并展开折叠语句，`detail::repeat_impl`的这个调用就相当于下面的语句。这里采用到`void`的类型转换来直接丢弃我们不需要的循环变量`I`值，因为我们需要的只是调用`func`产生的副作用。
```cpp
((void(0), func()), (void(1), func()), (void(2), func()), (void(3), func()));
```
6. 可以看出上面的语句实际上就是调用了四次`func()`。

当然，有的时候我们可能需要用到循环变量的值：

```cpp
void func(size_t i);
void test()
{
    for (size_t i = 0; i < 4; i++)
        func(i);
}
```

这种情况其实跟不需要循环变量的情况不差太多，实现如下：

```cpp
namespace detail
{
    template <typename F, size_t... I>
    void static_for_impl(F&& f, std::index_sequence<I...>)
    {
        (f(I), ...);
    }
}

template <size_t N, typename F>
void static_for(F&& f) 
{ 
    detail::static_for_impl(std::forward<F>(f), std::make_index_sequence<N>{}); 
}

void test() { static_for<4>(func); }
```

这样本文的内容就到此为止了。最后我希望大家**永远不要用到这种弱智东西**。
