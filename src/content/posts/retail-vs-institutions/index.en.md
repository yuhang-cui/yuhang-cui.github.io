---
title: "Do Institutions Target Retail Traders? Doing the Math on Apple's First Two Hours"
description: "A lot of retail traders feel institutions are harvesting them every day. Small caps really do get manipulated, but in a mega cap like Apple, the math of targeting retail just doesn't work. The ones trading against retail every day are market makers, and they make their money on the spread."
pubDatetime: 2025-09-12T20:00:00+08:00
tags: [Thinking]
lang: en
---

![A still from the film The Goldfinger: Tony Leung with a cigar, the subtitle reads "The Hong Kong stock market, I call the shots!"](./goldfinger.webp)

<p class="img-caption">A still from The Goldfinger (2023). Tony Leung plays a tycoon who built his fortune by rigging stock prices; the story is based on the Carrian Group scandal in 1980s Hong Kong. The subtitle reads: "The Hong Kong stock market, I call the shots!"</p>

## Summary

- **Small caps and the early Chinese A-share market really did have stock operators.** I'm not denying that.
- **Mega caps are very hard to target**: take Apple. In the first two hours, retail traded only about $1.2 billion. For an institution to push the price and "harvest" that money, the cost is far bigger than anything it could make.
- **The ones trading against retail every day are market makers**: they take most retail orders and make money on the bid-ask spread, not by pushing prices around.
- **For anyone trading ES**, the useful question isn't "who's targeting me?" but "what are the institutions doing right now?"

## Why it always feels like someone is pulling the strings

### 1. An immature early market

China's A-share market was set up in the early 1990s. It wasn't very market-driven, and the legal and regulatory framework was still incomplete. Listed companies varied a lot in quality, disclosure wasn't transparent, and enforcement was weak.

In that environment, institutions or individuals with deep pockets really did move stock prices by concentrating money in one name, cornering the float and pumping it. Chinese traders call these people "zhuangjia", the house that runs the stock.

### 2. A market dominated by retail

Unlike the US market, A-shares have long been mostly retail. At one point retail made up more than 80% of trading volume. Retail traders tend to have less information and to chase rallies and dump on drops, which makes them easy to "harvest" in short, money-driven moves.

So every time prices move strangely, retail traders feel like someone is behind it. When they make money, it's their own good judgment; when they lose, someone must be targeting them.

### 3. Well-known cases

- <strong>The D'Long Group scandal (2004)</strong>: it controlled several listed companies, cycled money between them and manipulated their stock prices for years, until its funding chain broke and it collapsed.
- <strong>Early speculation on the SME Board and ChiNext</strong>: many small caps were pumped by concentrated hot-money accounts, with sharp spikes and crashes and the clear marks of a cornered stock.

**Conclusion: in small caps and the early A-share market, stock operators were real.** What I want to look at next is a different question: in a mega cap like Apple, do institutions specifically go after retail?

## Why mega caps are hard to "target": the Apple example

On September 10, 2025, the day after Apple's fall event, Apple (AAPL) traded about **83.44 million shares**, in a range of $226–232, closing at $226.79.

US intraday volume is roughly U-shaped, heaviest at the open and the close. If the first two hours account for 25–30% of the day, that's about 21–25 million shares. At $229, that's **about $4.8–5.7 billion traded**.

JPMorgan estimates retail averages **20–25%** of US equity volume. Using the midpoint, in those two hours:

<figure class="day-funnel">
<p class="day-funnel-head"><span>Apple's first two hours, dollar volume (estimate)</span><strong>about $5.2 billion</strong></p>
<div class="day-funnel-bar" role="img" aria-label="Of about $5.2 billion traded in Apple's first two hours, retail was about $1.2 billion and institutions and others about $4.0 billion">
<span class="seg seg-keep" style="flex: 40"></span><span class="seg seg-roll" style="flex: 12"></span>
</div>
<ul class="day-funnel-legend">
<li><i class="seg-keep"></i><span>Institutions and others</span><b>about $4.0B</b></li>
<li><i class="seg-roll"></i><span>Retail</span><b>about $1.2B</b></li>
</ul>
<figcaption>Estimated from 83.44 million shares for the day, 27.5% in the first two hours, an average price of $229 and a 22.5% retail share. Bar lengths are proportional to dollar volume.</figcaption>
</figure>

### How much money is there to "harvest"?

Say an institution really could push the price 1% against retail, and every single retail trader was on the wrong side. Retail as a whole would lose only **about $12 million** ($1.2 billion × 1%).

### What would it cost?

Moving the price isn't as simple as throwing money at it. Apple's order book is deep, with plenty of resting orders on both sides at all times. To push the price up 1%, you have to keep lifting the offers stacked above you, and every fill gets worse as you go. To move the price inside $5 billion of two-hour volume, the institution would need to trade hundreds of millions to billions of dollars itself.

And once it's pushed the price up, it still has to get out, selling at worse and worse prices and paying the impact cost a second time. Along the way there are three more risks:

- **High-frequency traders get in front of it**: quant firms spot the footprint of a large order and buy ahead of it, raising its cost;
- **The price comes back**: as soon as it stops buying, price can drift right back, and all the impact cost is wasted;
- **Regulatory risk**: in the US, market manipulation is a serious crime.

On one side, a gain of maybe ten-odd million dollars. On the other, the cost and risk of pushing price back and forth in a multi-billion-dollar market. **The math doesn't work.** An institution's real opponents are other institutions. Retail is too small to be worth targeting.

## Who actually trades against retail: market makers

Most retail orders in US stocks never go straight to an exchange. Brokers sell them to market makers (this is called payment for order flow, PFOF). Market makers quote a bid and an ask at the same time: when retail buys, they sell; when retail sells, they buy. They earn the spread in between.

It's a big business:

- Citadel Securities, the largest market maker, has said it handled about **46%** of US retail orders in 2020;
- According to 2025 regulatory filings, market makers pay **more than $4.9 billion a year** for US equity and options order flow.

Market makers pay for retail orders precisely because those orders are small and spread out in both directions. Trading against them is low risk and the spread is steady money. **The real way institutions make money from retail is by collecting the spread and taking the other side when retail chases and panics, not by hunting retail on purpose.**

## Retail, long-term institutions, market makers: side by side

| | Retail | Long-term institutions | Market makers / HFT |
|---|---|---|---|
| Order size | Thousands to tens of thousands of dollars | Millions to hundreds of millions | Small per order, huge in total |
| Holding period | Minutes to days | Months to years | Seconds to minutes |
| How they make money | Price moves | Long-term company growth | The bid-ask spread |
| Effect on price | Scattered, almost none | Large orders move price | Provide liquidity, keep price steadier |
| Typical weakness | Chasing and panicking, poor stop discipline | Large orders are hard to hide | Can get run over in a fast one-way market |

## What this means for trading ES

The ES (E-mini S&P 500 futures) that I trade is an even bigger market than Apple, and almost all of its volume comes from institutions.

Al Brooks' price action approach starts from one basic premise: **only institutions can move the price; retail orders have no effect on it.** So every bar and every trend on the chart reflects institutions buying or selling. What a retail trader can do is read what the institutions are doing right now: are they pushing a trend, or buying low and selling high inside a range? Then trade in their direction.

The feeling that "my stop always gets hunted" can be understood the same way. Price goes to prior highs and lows because lots of institutional orders are already sitting there: some are adding to positions, some are getting stopped out. Price goes there because that's where the volume is, not because someone is watching your particular order.

**Instead of asking "who's targeting me?", ask "what are the institutions doing right now?"** That's the question a retail trader can actually use.

## Sources

- Apple volume and prices on 2025-09-10: [TipRanks historical prices](https://www.tipranks.com/stocks/aapl/historical-prices)
- Retail at 20–25% of US equity volume (JPMorgan): [Benzinga](https://www.benzinga.com/markets/tech/26/01/49671587/retail-investors-historic-2025-streak-record-inflows-record-influence)
- Citadel Securities handling about 46% of retail orders (2020): [Quartz](https://qz.com/1969196/citadel-securities-gets-almost-as-much-trading-volume-as-nasdaq/)
- Market makers paying more than $4.9 billion a year for order flow (May 2025): [Global Trading](https://www.globaltrading.net/payment-for-us-retail-flow-reaches-record-high-led-by-citadel-securities-imc/)
- The 25–30% share for the first two hours is an assumption based on the U-shaped intraday volume pattern in US stocks, not the actual figure for that day.

(First published on Xiaohongshu. Revised in October 2026: fixed calculation errors and added the sections on market makers and what this means for trading ES.)
