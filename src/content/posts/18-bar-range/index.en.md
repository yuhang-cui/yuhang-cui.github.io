---
title: "The 90% Rule for the Opening 18-Bar Range Looks More Like 81.4%"
description: "Al Brooks says that once one side of the range of the first 18 bars breaks, the other side usually holds, about 90% of the time. I tested it on 4,019 trading days of 1-minute ES data. The result: 81.4%."
stat: "81.4%"
statLabel: "other side holds"
pubDatetime: 2026-06-10T20:00:00+08:00
tags: [Research]
lang: en
---

> **Bottom line**: on days when one side breaks first, the opposite side holds **81.4%** of the time, not the 90% Al Brooks talks about.

## How I tested it

1. **Load the data**: read 16 years of 1-minute ES data from the source file and convert timestamps from UTC to US Eastern time, handling daylight saving time automatically.
2. **Keep RTH only**: keep 9:30 to 16:00 each day and drop everything before and after.
3. **Build 5-minute bars**: merge each day's 1-minute bars into 5-minute bars: open from the first bar, high is the max, low is the min, close from the last bar.
4. **Take the first 18 bars**: for each day, take the first 18 five-minute bars from 9:30 (through 10:59) and record their highest point (`range_high`) and lowest point (`range_low`).
5. **Track which side breaks first**: scan bar by bar from bar 19, recording when price first breaks above the top and when it first breaks below the bottom, and which happened first.
6. **Classify**: sort the 4,019 trading days into four groups: upside breakout first, downside breakout first, breakout on both sides, and no breakout on either side.
7. **Test the rule**: on days that broke the top first, check whether the bottom ever broke; on days that broke the bottom first, check whether the top ever broke. Conclusion: the rule holds **81.4%** of the time, not the 90% Al Brooks says.

## Results

Total trading days: **4,019**

### Upside first

| Case | Days | Share |
|---|---|---|
| Days that broke the top first | 2102 | 52.3% |
| 　Bottom held | 1726 | 82.1% |
| 　Bottom broke later | 376 | 17.9% |

### Downside first

| Case | Days | Share |
|---|---|---|
| Days that broke the bottom first | 1689 | 42.0% |
| 　Top held | 1359 | 80.5% |
| 　Top broke later | 330 | 19.5% |

### Other

| Case | Days | Share |
|---|---|---|
| Breakout on both sides | 708 | 17.6% |
| No breakout on either side | 226 | 5.6% |

### The 18-bar rule overall (excluding two-sided breakout days)

| Case | Days | Share |
|---|---|---|
| Days with a one-sided first breakout | 3791 | — |
| **Opposite side held** | **3085** | **81.4%** |
| Opposite side broke | 706 | 18.6% |

## Notes

**a.** Days where the opposite side broke add up to 706, but there are 708 two-sided breakout days. That's because a couple of extreme single bars broke both the top and the bottom at once, so they were counted twice. Here's the check:

```python
# Check for days where the same bar touched both edges of the range
same_bar = res[
    res['first_bo_up'].notna() &
    res['first_bo_down'].notna() &
    (res['first_bo_up'] == res['first_bo_down'])
]
print(f"Same bar touched both edges: {len(same_bar)} days")
print(same_bar[['date', 'range_high', 'range_low']].head())
```

Output:

```text
Same bar touched both edges: 2 days
           date  range_high  range_low
639  2012-12-12     1433.50    1428.75
766  2013-06-19     1652.75    1646.50
```

**b.** The data covers 4,019 trading days from 2010-6-6 to 2025-6-6.

(First published on Xiaohongshu.)
