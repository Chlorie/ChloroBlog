---
layout: post
categories: posts
title: 如何正确地使用函数 SFINAE
subtitle: 又开始了，又开始了
tags: [C++, 模板, TMP]
date-string: 2020-04-19
---

这篇文章很短，不过就算是我对之前自己的错误的一个更正吧。

假设我们需要根据一个谓词来选择性地启动/禁用某个函数重载，比如说想达成这种效果，让我们的算法只接受整数类型：

```cpp
template <typename T, /* Enable if T is integral type */>
void some_alg(T value) { ... }

int main()
{
    some_alg(0); // OK, 0 is int, int is an integral type
    // some_alg(0.0f); // Not OK, 0.0f is float, float isn't integral
}
```

我之前的写法的话可能是这样，使用 `std::enable_if` 来实现选择性启用：

```cpp
template <typename T, 
    typename = std::enable_if_t<std::is_integral_v<T>>>
void some_alg(T value) { ... }
```

不过这样写是有问题的，比如说用户可能会自己提供模板类型参数，如果用户自己提供了这第二个模板形参我们的默认参数就不起效果了，也就不能做到 SFINAE 的效果了。

```cpp
int main()
{
    some_alg<int>(0); // OK
    some_alg<int>(0.0f); // OK... 0.0f converted into int
    // some_alg<float>(0.0f); // This is still not OK
    some_alg<float, void>(0.0f); // Oops, we let this through
}
```

并且这种方法还有个问题，有时候我们会想要对满足不同的条件的类型做出不同的操作，比如说哪天我们发现这个算法其实可以接受浮点数，只不过需要有一点小改动，用刚才的方法的话就是这样：

```cpp
template <typename T, 
    typename = std::enable_if_t<std::is_integral_v<T>>>
void some_alg(T value) { ... }

template <typename T, 
    typename = std::enable_if_t<std::is_floating_point_v<T>>>
void some_alg(T value) { ... } // No
```

看起来好像两个函数模板格式不一样，但其实是会出问题的。默认参数是不在格式的考虑里面的，所以这俩函数模板其实格式是一样的，都是 `template <typename T, typename> void some_alg(T)`。

其实解决方案很简单，稍微改一下让 `std::enable_if` 实际地出现在模板的格式里面就 OK 了。

```cpp
template <typename T,
    std::enable_if_t<std::is_integral_t<T>>* = nullptr>
void some_alg(T value) { ... }

template <typename T,
    std::enable_if_t<std::is_floating_point_t<T>>* = nullptr>
void some_alg(T value) { ... }
```

这样两个问题就同时解决了。

不过 SFINAE 马上就要成了时代的眼泪了吧，有了 C++20 的 concept 以后对模板参数做限制变得很简单，前面这些工作就都变得多余了。那个整数的例子用 concept 就可以简化成这样：

```cpp
// Full version
template <typename T> requires std::integral<T>
void some_alg(T value) { ... }

// Shorter version
template <std::integral T>
void some_alg(T value) { ... }

// Even shorter version
void some_alg(std::integral auto value) { ... }
```

所以现在就希望主流编译器赶紧支持 C++20……
