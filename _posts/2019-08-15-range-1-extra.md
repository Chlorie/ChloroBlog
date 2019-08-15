---
layout: post
categories: posts
title: 无限长序列、惰性计算与C++(1.5)
subtitle: 我有独特的运算符重载技巧
tags: [C++, 函数式编程, 模板]
date-string: 2019-08-15
---
其实这篇文章算是上一篇的一个补充。上期提到过C++20的范围库，在其中范围的变换函数都是有两种写法的。就拿上期实现的筛选操作为例：
```cpp
filter(range, predicate) // Normal way to call a transformer
range | filter(predicate) // Pipe-like way to call a transformer
```

第二种方法看起来确实是在滥用运算符重载，就像C++中常用的`operator<<`和`operator>>`一样，因为形状像是个箭头就被当成了流操作的运算符。范围库的作者对这个重载也是有说法的，因为C++表示或运算的竖杠字符在Unix命令中表示一种管道的含义，把前面的数据输入到后面的操作中继续处理。而且，这样用重载运算符还有一个好处，那就是串接变换函数的语句变得直观易懂了。可以看出，下面的“管道”语法确实比由内向外从右往左读的普通函数调用语法更直观。
```cpp
// Taking the sequence of natural numbers, find the prime ones,
// take the first 10, and then enumerate them
enumerate(take_n(filter(iota, is_prime), 10)) // Function call syntax
iota | filter(is_prime) | take_n(10) | enumerate // Pipe-like syntax
```

下面我们就来实现这种运算符重载。其实实现非常简单，因为在管道运算符右侧的`filter`函数调用仅需要提供一个参数，就是筛选要用到的一元谓词。构造一个辅助类用作这个函数的返回类型。在`operator|`的实现中，只需要把各个参数转发到原来的函数调用式`filter`函数里就可以了。
```cpp
template <typename Predicate> 
struct filter_adaptor_t final { Predicate&& predicate; };

template <typename Predicate>
filter_adaptor_t<Predicate> filter(Predicate&& predicate)
{
    return { std::forward<Predicate>(predicate) };
}

template <typename Range, typename Predicate>
auto operator|(Range&& range, filter_adaptor_t<Predicate> adaptor)
{
    return filter(std::forward<Range>(range), std::forward<Predicate>(adaptor.predicate));
}
```

这样上一期的代码就可以写成这个样子： ~~看起来是不是非常cool？（超绝问题发言）~~
```cpp
for (const auto i : iota | filter(is_prime))
    std::cout << i << '\n';
```

下一期我们就来实现亲民的`take_n`（取前n个元素）以及实现起来丧心病狂的`zip`和`cartesian_product`操作……
