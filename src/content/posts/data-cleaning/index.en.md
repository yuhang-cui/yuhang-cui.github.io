---
title: "16 Years of 1-Minute ES Data: Where I Got It and How I Cleaned It"
description: "The data comes from Databento's official CME market data feed. The prices themselves are clean. The real trouble is which days you can't use: contract rolls, holidays, half days and data gaps. After dropping about 2% of full trading days, 3,924 days are left that I can trust."
stat: "3924"
statLabel: "usable trading days after cleaning"
pubDatetime: 2026-04-14T20:00:00+08:00
tags: [Tools]
featured: true
lang: en
---

## Summary

- **Where the data comes from**: I bought it from [Databento](https://databento.com). The dataset is CME's official feed, **CME Globex MDP 3.0** (code `GLBX.MDP3`). The instrument is the ES (E-mini S&P 500 futures) continuous contract `ES.c.0`, **1-minute bars**, from June 2010 to September 2026.
- **The prices themselves are clean**: no missing values, no duplicate timestamps, no impossible highs or lows, and every price sits on the 0.25 tick.
- **The real problem is which days you can't use.** I dropped three kinds of days:
  1. **Days around a contract roll** (66 rolls): old and new contract prices don't line up, and on expiration Friday there's no RTH data at all;
  2. **Holidays and half days** (128 days, 5 of which overlap with a roll): the stock market is closed and only futures trade, or the market closes early at 13:00;
  3. **Days with bad data** (14 days): a big chunk missing from the feed, or an overnight session stretched over several nights by a holiday.
- **Result**: **3,924** trading days left, losing only about 2% of full trading days. Every study on this site uses this data.

## Where the data comes from

![The CME Globex MDP 3.0 dataset page on Databento](./databento-glbx-mdp3.png)

CME Globex MDP 3.0 is the Chicago Mercantile Exchange's official market data feed. Every futures and options contract that trades on Globex comes through it. Databento has this data from June 6, 2010 onward and charges by usage. Downloading the 1-minute bars cost me about $20.

Here's exactly what I downloaded:

| Item | Choice |
|---|---|
| Dataset | CME Globex MDP 3.0 (`GLBX.MDP3`) |
| Instrument | ES, E-mini S&P 500 futures |
| Contract | `ES.c.0`, continuous contract (see below) |
| Bars | OHLCV-1m: 1-minute open, high, low, close and volume |
| Date range | 2010-06 to 2026-09 |
| Format | CSV |

### Why a "continuous contract"

ES isn't one contract. There's **one for every quarter**: ESZ6 expires in December 2026, ESH7 in March 2027, and so on. Each contract is the front month only for the few months before it expires.

To study 16 years of price action, you have to stitch these contracts together end to end. `ES.c.0` is the continuous contract Databento stitches for you: it always follows the nearest expiry and rolls to the next one after expiration. That automatic roll turns out to be the biggest trap.

## The prices themselves are clean

I checked all of the roughly 5.5 million 1-minute bars:

| Check | Result |
|---|---|
| Missing values / duplicate timestamps | 0 / 0 |
| High below open or close, low above open or close | 0 |
| Prices off the 0.25 tick | 0 |
| Extremely large bars | Spot checks all match real events, like the 2020 circuit breakers and the 2025-04-09 tariff pause |
| Cross-check against SPY (2023–2024, about 8,000 bars) | ES/SPY price ratio deviates by at most 0.23%, no bad prices found |

## The real problem: which days you can't use

### 1. Around contract rolls (66 rolls)

`ES.c.0` only switches to the new contract **on the Sunday evening after expiration Friday**. But the old contract stops trading at 9:30 a.m. on expiration Friday. So:

- **There's no RTH data at all on expiration Friday**;
- When the code looks for Monday's overnight session, it searches back to Thursday evening and splices "Thursday evening (old contract) + Sunday evening (new contract)" into one overnight session. Old and new contracts usually differ by 10 to several dozen points, once by as much as 224 points, so the spliced overnight high and low are fake.

<figure class="roll-timeline">
<div class="roll-timeline-scroll">
<svg viewBox="0 0 740 214" role="img" aria-label="Roll week: the old contract stops trading at 9:30 on Friday, Friday has no RTH data, and the new contract only starts Sunday evening. The code splices Thursday evening and Sunday evening into one overnight session, so everything from Thursday 16:15 to Monday 16:15 is deleted.">
<defs>
<pattern id="roll-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="tl-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern>
</defs>
<rect class="tl-closed" x="273.7" y="30" width="212.3" height="150"/>
<line class="tl-grid" x1="96" y1="30" x2="96" y2="180"/><line class="tl-grid" x1="200" y1="30" x2="200" y2="180"/><line class="tl-grid" x1="304" y1="30" x2="304" y2="180"/><line class="tl-grid" x1="408" y1="30" x2="408" y2="180"/><line class="tl-grid" x1="512" y1="30" x2="512" y2="180"/><line class="tl-grid" x1="616" y1="30" x2="616" y2="180"/><line class="tl-grid" x1="720" y1="30" x2="720" y2="180"/>
<text class="tl-day" x="148" y="20" text-anchor="middle">Thu</text>
<text class="tl-day" x="252" y="20" text-anchor="middle">Fri · expiry</text>
<text class="tl-day" x="356" y="20" text-anchor="middle">Sat</text>
<text class="tl-day" x="460" y="20" text-anchor="middle">Sun</text>
<text class="tl-day" x="564" y="20" text-anchor="middle">Mon</text>
<text class="tl-day" x="668" y="20" text-anchor="middle">Tue</text>
<text class="tl-row" x="0" y="57">ES.c.0</text>
<rect class="tl-old" x="96" y="42" width="145.2" height="22" rx="3"/>
<text class="tl-in" x="168.6" y="57" text-anchor="middle">Old contract</text>
<rect class="tl-gap" x="241.2" y="42" width="28.1" height="22" fill="url(#roll-hatch)"/>
<rect class="tl-new" x="486" y="42" width="234" height="22" rx="3"/>
<text class="tl-in" x="603" y="57" text-anchor="middle">New contract</text>
<text class="tl-note" x="255" y="82" text-anchor="middle">No RTH data</text>
<text class="tl-note" x="380" y="57" text-anchor="middle">Weekend</text>
<text class="tl-row" x="0" y="117">Deleted</text>
<rect class="tl-cut" x="166.4" y="102" width="416" height="22" rx="3"/>
<text class="tl-cut-text" x="374.4" y="117" text-anchor="middle">Thu 16:15 → Mon 16:15</text>
<text class="tl-row" x="0" y="157">Spliced ETH</text>
<rect class="tl-old" x="166.4" y="146" width="74.8" height="16" rx="3"/>
<rect class="tl-new" x="486" y="146" width="67.2" height="16" rx="3"/>
<line class="tl-link" x1="241.2" y1="154" x2="486" y2="154"/>
<text class="tl-note" x="363.6" y="146" text-anchor="middle">Treated as one overnight session</text>
<text class="tl-warn" x="374.4" y="202" text-anchor="middle">Old and new contracts differ by 10+ points, up to 224: the spliced Monday overnight high/low is fake</text>
</svg>
</div>
<figcaption>Roll week. Gray is the old contract, blue is the new one. Time is drawn to scale, 24 hours per day.</figcaption>
</figure>

**What I did**: for every roll, delete everything from Thursday evening to Monday's close after the roll. Monday is dropped entirely; Tuesday is kept in full.

One special case: in June 2026, expiration day fell on Juneteenth (Friday 6/19, market closed), so expiration moved up to Thursday and the contract rolled that same evening. I handled it separately.

### 2. Holidays and half days (128 days)

5 of these fall inside a roll's deletion window and are already gone with the roll, so the funnel below counts only 123 for this group.

- **Stock market closed, futures open for half a day**: Martin Luther King Jr. Day, Presidents' Day, Memorial Day, July 4, Labor Day, Thanksgiving, Juneteenth. The stock market isn't open at all on these days, and volume is only 1–10% of normal;
- **Stock market closes early at 13:00**: the day after Thanksgiving, July 3, Christmas Eve. Only half a session, not comparable with a full trading day.

### 3. Days with bad data (14 days)

| Problem | Days | Example |
|---|---|---|
| Big chunk missing from the feed | 3 | 2020-02-28: no data from 10:58 a.m. until Sunday evening |
| Overnight session stretched over several nights by a holiday | 8 | Good Friday (stocks closed, futures had a morning session); Hurricane Sandy closed stocks for two days; two presidential state funerals |
| First day after a fully missing day | 3 | The source data is missing 6 regular trading days entirely in 2014, so the day after each of them gets the wrong "yesterday" |

## Cleaning results

<figure class="day-funnel">
<p class="day-funnel-head"><span>Days with RTH data in the raw file</span><strong>4,129 days</strong></p>
<div class="day-funnel-bar" role="img" aria-label="Of 4,129 days with RTH data, 3,924 are kept; 68 dropped for rolls, 123 for holidays and half days, 14 for bad data">
<span class="seg seg-keep" style="flex: 3924"></span><span class="seg seg-roll" style="flex: 68"></span><span class="seg seg-hol" style="flex: 123"></span><span class="seg seg-bad" style="flex: 14"></span>
</div>
<ul class="day-funnel-legend">
<li><i class="seg-keep"></i><span>Kept</span><b>3,924</b></li>
<li><i class="seg-roll"></i><span>Around contract rolls (66 rolls)</span><b>−68</b></li>
<li><i class="seg-hol"></i><span>Holidays and half days</span><b>−123</b></li>
<li><i class="seg-bad"></i><span>Bad data</span><b>−14</b></li>
</ul>
<figcaption>Counted in RTH trading days; bar lengths are proportional to the number of days. The 5 holidays that overlap with a roll are counted once. Holidays and half days aren't full trading days to begin with. Counting only full trading days, 77 of 4,001 were dropped, about 2%.</figcaption>
</figure>

| | Result |
|---|---|
| Usable trading days | **3,924 days**, all covering RTH 09:30–16:15. 3,901 of them have the full 405 one-minute bars (81 five-minute bars); the other 23 are missing a few (see Limitations) |
| Loss | About 2% of full trading days |
| Overnight sessions mixing two contracts | 0 |
| Overnight sessions spanning several nights | 0 |

## Limitations

- **The week before expiration uses the expiring contract**, whose volume is only about 1/4 of the new one. It barely matters for price structure, but exclude those days when you study volume;
- **Prices are not back-adjusted**, so price jumps at each roll. Percentages are fine, but don't compare absolute point moves across different years;
- **Data before May 21, 2017 comes from the exchange's historical files**, without Databento's own capture timestamps. It hardly matters for 1-minute bars, but it's worth knowing;
- **23 days are missing a few RTH bars**: 19 are in expiration week, when the old contract trades thinly and some minutes have no trades, so no bar (1–9 bars short per day); the other 4 are the March 2020 circuit breakers, when trading halted for 15 minutes (13–14 bars short per day). The prices are fine; just those few minutes are missing;
- **46 days have incomplete overnight data**. RTH is normal on those days, so I didn't drop them. Filter them out separately if you study the overnight session.

## How I use it

Every study on this site is built on this cleaned data, and I won't repeat the details in each post. The cleaning rules are in one script; when new data comes in, I just rerun it.

## How to reproduce it

<div class="prompt-card">
<p class="prompt-card-head">Prompt: download the data</p>
<pre class="prompt-text">Please write Python code that downloads historical 1-minute bars for ES futures (S&P 500 E-mini) from Databento. Requirements:
1. Use the official databento library; dataset GLBX.MDP3 (CME Globex MDP 3.0), symbol ES.c.0, stype continuous (continuous contract), schema ohlcv-1m.
2. Date range from 2010-06-06 to today.
3. First call metadata.get_cost to look up and print the cost of this download. Only download after I type y to confirm, so I don't get charged by mistake.
4. Ask me for the API key at runtime with getpass. Don't put it in the code or any file.
5. Save the result as CSV, keeping the original columns such as ts_event, instrument_id, open, high, low, close, volume, with timestamps in UTC.
6. After downloading, print the total row count and the timestamps of the first and last rows so I can check them.
7. Add comments to every step, and tell me what I need to install first (pip install databento).</pre>
</div>

<div class="prompt-card">
<p class="prompt-card-head">Prompt: clean the data</p>
<pre class="prompt-text">I have a CSV of 1-minute ES futures bars (Databento's ES.c.0 continuous contract, timestamps in UTC, with an instrument_id column). Please write Python code to clean it, following these rules:
1. Convert timestamps to US Eastern time (US/Eastern), handling daylight saving time automatically. RTH = 09:30–16:15 (1-minute bars from 09:30 to 16:14, 405 bars); ETH = previous trading day 16:15 to 09:29 today.
2. First check data quality and print the results: missing values, duplicate timestamps, rows where the high is below the open/close or the low is above the open/close, and prices not on the 0.25 tick.
3. Remove data around contract rolls: find where instrument_id changes (the roll), and delete everything from 16:15 on the last trading day before expiration to 16:15 on the first trading day after the roll. Expiration is usually the third Friday; if that day is a holiday, expiration moves up a day, so handle that case separately.
4. Remove holidays and half days: days whose last RTH bar is earlier than 13:30 (stock market closed with only futures trading, or an early 13:00 close). Delete the previous evening's overnight session along with them.
5. Remove days whose overnight session spans two or more nights (for example Good Friday or a state funeral, when stocks are closed but futures trade), and the first day after any fully missing day.
6. Write out the cleaned 1-minute data, and also build 5-minute bars in US Eastern time (open = first bar's open, high = max, low = min, close = last bar's close, volume = sum).
7. Finally verify and print: how many trading days are left, whether every day has a complete RTH session (405 one-minute bars), and whether any day's overnight session mixes two contracts.
Please add comments to every step explaining why it's done that way.</pre>
</div>

(Note: in October 2026 I downloaded the April–September 2026 data as well. The date range and numbers in this post reflect the merged data.)
