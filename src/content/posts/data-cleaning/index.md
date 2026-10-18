---
title: "16 年 ES 一分钟数据：我从哪里获得，又是怎么“清洗”的"
description: "数据来自 Databento 的 CME 官方行情数据集。价格本身很干净，真正的坑在“哪些日子不能用”：换合约、节假日、半日市和数据空洞。删掉约 2% 的完整交易日之后，剩下 3924 天可以放心用。"
stat: "3924"
statLabel: "清洗后可用交易日"
pubDatetime: 2026-04-14T20:00:00+08:00
tags: [Tools]
featured: true
---

## 总结

- **数据从哪里来**：从 [Databento](https://databento.com) 购买，数据集是 CME 官方行情 **CME Globex MDP 3.0**（代码 `GLBX.MDP3`），品种是 ES（标普 500 E-mini 期货）的连续合约 `ES.c.0`，**1 分钟 K 线**，时间从 2010 年 6 月到 2026 年 9 月。
- **价格本身是干净的**：没有缺失值、没有重复时间、没有不合理的高低价，所有价格都落在 0.25 的最小跳动单位上。
- **真正的问题出在“哪些日子不能用”**，我删掉了三类日子：
  1. **换合约前后几天**（66 次）：新旧合约价格对不上，交割日白天还完全没有数据；
  2. **节假日和半日市**（128 天，其中 5 天和换约重叠）：股市休市只有期货开盘，或者 13:00 就提前收盘；
  3. **数据有问题的日子**（14 天）：数据源中间缺一大段，或者夜盘被假期拉长到包含好几个晚上。
- **结果**：剩下 **3924 个**交易日，只损失约 2% 的完整交易日。以后所有研究都基于这份数据。

## 数据从哪里来

![CME Globex MDP 3.0 数据集介绍页](./databento-glbx-mdp3.png)

CME Globex MDP 3.0 是芝加哥商品交易所（CME）的官方行情数据源，Globex 上交易的所有期货、期权都从这里发出。Databento 从 2010 年 6 月 6 日开始收录这份数据，按用量收费，我当时下载 1 分钟 K 线花了大约 20 美元。

我下载的具体内容：

| 项目 | 选择 |
|---|---|
| 数据集 | CME Globex MDP 3.0（`GLBX.MDP3`） |
| 品种 | ES，E-mini S&P 500 期货 |
| 合约 | `ES.c.0`，连续合约（见下文） |
| K 线 | OHLCV-1m，也就是 1 分钟的开高低收和成交量 |
| 时间范围 | 2010-06 ～ 2026-09 |
| 格式 | CSV |

### 为什么要用“连续合约”

ES 不是一个合约，而是**每个季度一个**：ESZ6 是 2026 年 12 月到期，ESH7 是 2027 年 3 月到期，以此类推。每个合约只在到期前的几个月里是主力。

要研究 16 年的走势，就得把这些合约首尾接起来。`ES.c.0` 就是 Databento 自动接好的“连续合约”：永远取当前最近到期的那一个，到期后自动换到下一个。这个“自动换”正是后面最大的坑。

## 价格本身是干净的

我检查了全部约 550 万行 1 分钟 K 线：

| 检查项 | 结果 |
|---|---|
| 缺失值 / 重复时间 | 0 / 0 |
| 最高价低于开收盘、最低价高于开收盘 | 0 |
| 不在 0.25 最小跳动单位上的价格 | 0 |
| 极端大 K 线 | 抽查都对得上真实事件，比如 2020 年熔断、2025-04-09 关税暂停 |
| 用 SPY 独立核对（2023–2024，约 8000 根 K 线） | ES 与 SPY 的价格比值最大偏离 0.23%，没发现错价 |

## 真正的问题：哪些日子不能用

### 1. 换合约前后（66 次）

`ES.c.0` 是在**交割周五之后的那个周日晚上**才换到新合约的。可旧合约在交割周五早上 9:30 就停止交易了，所以：

- **交割周五的白天完全没有数据**；
- 程序找周一的夜盘时，会一路往前找到周四晚上，把“周四晚上（旧合约）+ 周日晚上（新合约）”拼成一个夜盘。新旧合约价格通常差十几到几十点，最多差过 224 点，拼出来的夜盘高低点是假的。

<figure class="roll-timeline">
<div class="roll-timeline-scroll">
<svg viewBox="0 0 740 214" role="img" aria-label="换约那一周：旧合约在周五 9:30 停止交易，周五白盘没有数据，周日晚上才换成新合约；程序把周四晚上和周日晚上拼成一个夜盘，所以删掉周四 16:15 到周一 16:15">
<defs>
<pattern id="roll-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="tl-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern>
</defs>
<rect class="tl-closed" x="273.7" y="30" width="212.3" height="150"/>
<line class="tl-grid" x1="96" y1="30" x2="96" y2="180"/><line class="tl-grid" x1="200" y1="30" x2="200" y2="180"/><line class="tl-grid" x1="304" y1="30" x2="304" y2="180"/><line class="tl-grid" x1="408" y1="30" x2="408" y2="180"/><line class="tl-grid" x1="512" y1="30" x2="512" y2="180"/><line class="tl-grid" x1="616" y1="30" x2="616" y2="180"/><line class="tl-grid" x1="720" y1="30" x2="720" y2="180"/>
<text class="tl-day" x="148" y="20" text-anchor="middle">周四</text>
<text class="tl-day" x="252" y="20" text-anchor="middle">周五 · 交割</text>
<text class="tl-day" x="356" y="20" text-anchor="middle">周六</text>
<text class="tl-day" x="460" y="20" text-anchor="middle">周日</text>
<text class="tl-day" x="564" y="20" text-anchor="middle">周一</text>
<text class="tl-day" x="668" y="20" text-anchor="middle">周二</text>
<text class="tl-row" x="0" y="57">ES.c.0</text>
<rect class="tl-old" x="96" y="42" width="145.2" height="22" rx="3"/>
<text class="tl-in" x="168.6" y="57" text-anchor="middle">旧合约</text>
<rect class="tl-gap" x="241.2" y="42" width="28.1" height="22" fill="url(#roll-hatch)"/>
<rect class="tl-new" x="486" y="42" width="234" height="22" rx="3"/>
<text class="tl-in" x="603" y="57" text-anchor="middle">新合约</text>
<text class="tl-note" x="255" y="82" text-anchor="middle">白盘无数据</text>
<text class="tl-note" x="380" y="57" text-anchor="middle">周末休市</text>
<text class="tl-row" x="0" y="117">删除区间</text>
<rect class="tl-cut" x="166.4" y="102" width="416" height="22" rx="3"/>
<text class="tl-cut-text" x="374.4" y="117" text-anchor="middle">周四 16:15 → 周一 16:15</text>
<text class="tl-row" x="0" y="157">拼成的夜盘</text>
<rect class="tl-old" x="166.4" y="146" width="74.8" height="16" rx="3"/>
<rect class="tl-new" x="486" y="146" width="67.2" height="16" rx="3"/>
<line class="tl-link" x1="241.2" y1="154" x2="486" y2="154"/>
<text class="tl-note" x="363.6" y="146" text-anchor="middle">程序当成同一个夜盘</text>
<text class="tl-warn" x="374.4" y="202" text-anchor="middle">新旧合约差十几到几十点，最多 224 点：拼出来的周一夜盘高低点是假的</text>
</svg>
</div>
<figcaption>换约那一周。灰色是旧合约，蓝色是新合约，时间按 24 小时等比例画。</figcaption>
</figure>

**处理**：每次换约，删掉从周四晚上到换约后周一收盘这一段。周一整天删掉，周二完整保留。

特例：2026 年 6 月的交割日碰上六月节（6/19 周五休市），交割提前到周四，当晚就换了合约，处理时单独考虑。

### 2. 节假日和半日市（128 天）

其中 5 天正好落在换约的删除区间里，已经随换约一起删掉，所以下面漏斗图里这一类只算 123 天。

- **股市休市、只有期货开半天**：马丁·路德·金纪念日、总统日、阵亡将士纪念日、7 月 4 日、劳动节、感恩节、六月节。这些天股票市场根本没开，成交量只有平时的 1–10%；
- **股市 13:00 提前收盘**：感恩节第二天、7 月 3 日、平安夜。只有半天，和完整交易日不可比。

### 3. 数据有问题的日子（14 天）

| 情况 | 天数 | 例子 |
|---|---|---|
| 数据源中间缺一大段 | 3 | 2020-02-28 上午 10:58 之后直到周日晚上都没有数据 |
| 夜盘被假期拉长，包含好几个晚上 | 8 | 耶稣受难日股市休市但期货开了早盘；飓风桑迪股市停了两天；两次总统国葬 |
| 整天缺失之后的第一天 | 3 | 源数据里 2014 年有 6 个正常交易日整天缺失，它们后面那一天的“昨天”会取错 |

## 清洗结果

<figure class="day-funnel">
<p class="day-funnel-head"><span>原始数据里有白盘的日子</span><strong>4129 天</strong></p>
<div class="day-funnel-bar" role="img" aria-label="4129 个有白盘的日子中，保留 3924 天，删掉换约 68 天、节假日和半日市 123 天、数据有问题 14 天">
<span class="seg seg-keep" style="flex: 3924"></span><span class="seg seg-roll" style="flex: 68"></span><span class="seg seg-hol" style="flex: 123"></span><span class="seg seg-bad" style="flex: 14"></span>
</div>
<ul class="day-funnel-legend">
<li><i class="seg-keep"></i><span>保留</span><b>3924</b></li>
<li><i class="seg-roll"></i><span>换合约前后（66 次）</span><b>−68</b></li>
<li><i class="seg-hol"></i><span>节假日和半日市</span><b>−123</b></li>
<li><i class="seg-bad"></i><span>数据有问题</span><b>−14</b></li>
</ul>
<figcaption>按白盘交易日计，条形长度按天数等比例画。和换约重叠的 5 个节假日只算一次。节假日和半日市本来就不是完整交易日，只看完整交易日的话，4001 天里删掉 77 天，约 2%。</figcaption>
</figure>

| | 结果 |
|---|---|
| 可用交易日 | **3924 天**，白盘都覆盖 09:30–15:59；其中 3901 天是完整的 390 根 1 分钟 K 线，另外 23 天少几根（见“局限”） |
| 损失 | 约 2% 的完整交易日 |
| 混入两个合约的夜盘 | 0 |
| 包含多个晚上的夜盘 | 0 |

## 局限

- **交割前一周用的是快到期的旧合约**，成交量只有新合约的约 1/4。研究价格结构影响不大，研究成交量时要排除这几天；
- **价格没有复权**，换合约时价格会跳一下。看百分比没问题，但不要拿不同年份的绝对点数直接比较；
- **2017 年 5 月 21 日之前的数据来自交易所的历史文件**，没有 Databento 自己的采集时间戳。对 1 分钟 K 线影响不大，但值得知道；
- **有 23 天白盘少了几根 K 线**：19 天在交割周，旧合约成交清淡，有些分钟没有成交，也就没有 K 线（每天少 1–9 根）；另外 4 天是 2020 年 3 月的熔断，交易暂停了 15 分钟（每天少 13–14 根）。价格本身没错，只是缺了这几分钟；
- **有 46 天夜盘数据不完整**，白盘是正常的，所以没有删。做夜盘研究时要单独过滤。

## 我怎么用它

以后每一篇研究都基于这份清洗后的数据，文章里不再重复说明。清洗规则写成了一个脚本，有新数据时重新跑一遍即可。

## 如何复现

<div class="prompt-card">
<p class="prompt-card-head">Prompt：下载数据</p>
<pre class="prompt-text">请帮我写一段 Python 代码，从 Databento 下载 ES 期货（标普 500 E-mini）的历史 1 分钟 K 线。要求：
1. 使用官方 databento 库；数据集 GLBX.MDP3（CME Globex MDP 3.0），合约代码 ES.c.0，代码类型 continuous（连续合约），数据格式 ohlcv-1m。
2. 时间从 2010-06-06 到今天。
3. 先用 metadata.get_cost 查询并打印这次下载的费用，等我输入 y 确认后才真正下载，避免误扣费。
4. API 密钥运行时用 getpass 让我手动输入，不要写在代码或文件里。
5. 把结果保存为 CSV，保留 ts_event、instrument_id、open、high、low、close、volume 等原始列，时间保持 UTC。
6. 下载完打印总行数、第一行和最后一行的时间，方便我核对。
7. 每一步都加中文注释，告诉我需要先安装什么（pip install databento）。</pre>
</div>

<div class="prompt-card">
<p class="prompt-card-head">Prompt：清洗数据</p>
<pre class="prompt-text">我有一份 ES 期货 1 分钟 K 线 CSV（Databento 的 ES.c.0 连续合约，时间是 UTC，含 instrument_id 列）。请帮我写 Python 代码完成清洗，规则如下：
1. 把时间转成美东时间（US/Eastern），自动处理夏令时。白盘 RTH = 09:30–15:59；夜盘 ETH = 前一个交易日 16:15 到当天 09:29。
2. 先检查数据质量并打印结果：缺失值、重复时间、最高价低于开收盘或最低价高于开收盘、价格不在 0.25 最小跳动单位上的行数。
3. 删除换合约前后的数据：找出 instrument_id 变化的位置（换约），删掉“交割日前最后一个交易日 16:15”到“换约后第一个交易日 16:15”这一段。交割日一般是第三个周五；如果那天放假，交割会提前一天，要单独处理。
4. 删除节假日和半日市：白盘最后一根 K 线早于 13:30 的日子（股市休市只有期货开盘，或 13:00 提前收盘），同样连前一晚的夜盘一起删。
5. 删除夜盘包含两个及以上晚上的日子（比如耶稣受难日、国葬日股市休市但期货照常交易），以及整天缺失数据之后的第一天。
6. 输出清洗后的 1 分钟数据，并按美东时间合成一份 5 分钟数据（开盘取第一根、最高取最大、最低取最小、收盘取最后一根、成交量求和）。
7. 最后验证并打印：剩下多少个交易日、每天白盘是否完整（390 根 1 分钟 K 线）、有没有任何一天的夜盘混入两个合约。
请每一步加中文注释，说明为什么这样做。</pre>
</div>

（补充说明：2026 年 10 月补充下载了 2026 年 4–9 月的数据，文中的时间范围和数字已按合并后的数据更新。）
