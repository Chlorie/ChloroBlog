---
layout: post
categories: posts
title: 何为“正确的每一打”？
subtitle: 日麻存在近似均衡的纯策略吗？
tags: [杂谈, 麻将, 博弈]
date-string: 2020-09-28
---

好久没发 blog 了，最近摸鱼总打麻将，那这次就随便说说麻将？

虽然是个休闲玩家，有时候也会显示人类本性在遇到小概率事件的时候狂喜或者怒骂，但是自己也是在朝着雀力日进的目标努力的。之前有很长一段时间自己对那几个统计数字非常在意，于是给自己定一些显式的目标，比如说之前我一直在故意压低自己的铳率。后来意识到有些放铳是不可避免的，于是转而追求更难实现的一个终极目标，那就是追求“正确的每一打”。

“正确的每一打”可以认为是某种 consistency。在お知らせ的麻将教材《世界最強 AI Suphx の衝撃》当中说到：“AI 只要没有经过更新，其判断就永远是前后一致的。无论看多少次同一牌谱的同一场面，其打牌选择必不会改变。”（具体的原话我当然是没有看过的，毕竟我也没买那本书，这里面用的是 B 站上石连寺财团的翻译。）并且，他将这一点作为 AI 牌谱相对于人类打者牌谱作为教材的优越性。因为高段人类打者仍然可能会出现鸡打（或者说做出了以自己的判断标准来看不达标的打牌）的情况，而 AI 则不会出现这种问题，它是 consistent 的。我之前虽说粗略看过 Suphx 的论文，但是由于没仔细看而且时间过了太久可能会印象不深刻。我记得那一篇论文里面并没有细讲网络的输出跟 Suphx 的实际行动的关联：网络输出的是一个经过 softmax 操作的概率向量 $$p$$，那么这个向量是直接作为 Suphx 行动的概率分布（混合策略），还是说 Suphx 永远都是取概率最大的 $$\arg\max{_i}p^\top e_i$$ 作为其最终的行动（纯策略）？

如果假设 Suphx 网络输出的策略是最优的，那么问题就转变成了 $$p$$ 中非最大的非零分量对策略本身的贡献是否显著。举个例子，如果网络输出在状态 $$s$$ 之下判断是否吃的网络的输出是 $$p_{(y,n)}=(0.55,0.45)$$，那么如果采用 $$\arg\max$$ 作为其最终选择的动作的话这个 agent 确实会选择吃操作，但是由于两个操作的概率差值并不显著，如果在所有场面都选择 $$\arg\max$$ 的话显然是不妥的，就好比玩石头剪刀布的时候没有人会一直出同一种手势一样；反过来，如果 AI 选择的是将网络输出的向量作为概率进行动作的抽样的话，那它在某种程度上也就不是永远 consistent 的了——它在同一个场景下可能会做出不同的选择。

没有人见过完全一样的局面，Suphx 会不会在一样的局面下采用不同的纯策略这个问题估计只有开发者团队知道了吧。不过话说回来，麻将如此复杂的积分规则会不会导致这个博弈有近似均衡的纯策略近似解呢？或者说必须要采用随机的混合策略的状态数可能几千场都不会遇到一次？

不过菜鸡如我还是远远没有资格评论在如此复杂的场面之下的正确做法的吧。