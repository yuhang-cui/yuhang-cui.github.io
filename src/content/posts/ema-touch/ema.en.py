# 20 EMA: on the 5-minute RTH chart, how many days touch the 20 EMA? Which bar touches it first? How many bars in a row does price stay away from it?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC, with an instrument_id column)
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "instrument_id", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # minutes since 09:30
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), bar=m // 5)   # RTH 09:30–16:15, 81 five-minute bars a day

# Build 5-minute bars as a table with one row per day and 81 columns; a 5-minute slot with no trades (the March 2020 circuit breakers) is empty
bars = rth.groupby(["date", "bar"]).agg(h=("high", "max"), l=("low", "min"), c=("close", "last"))
H, L, C = (bars[k].unstack().reindex(columns=range(81)).values for k in ["h", "l", "c"])
days = bars.index.get_level_values(0).unique()
inst = rth.groupby("date").instrument_id.first().values

# 20 EMA: alpha = 2/21, RTH bars only, carried from day to day; empty 5-minute slots are skipped
# On the first day of a new contract the EMA restarts and that day isn't counted (old and new contract prices don't line up); same for the first day of the data
ema = np.full(H.shape, np.nan)
use = np.ones(len(days), bool)
e = None
for i in range(len(days)):
    if i == 0 or inst[i] != inst[i - 1]:
        e, use[i] = None, False
    for k in range(81):
        if not np.isnan(C[i, k]):
            e = C[i, k] if e is None else 2 / 21 * C[i, k] + 19 / 21 * e
        ema[i, k] = e

touch = (L <= ema) & (ema <= H)                              # the EMA sits between the bar's high and low
first = np.where(touch.any(1), touch.argmax(1) + 1, 0)[use]  # which bar touches first; 0 if never
d = days[use]
print(f"Sample {len(first)} days, touched the 20 EMA {100 * (first > 0).mean():.2f}%, touched on bar 1 {100 * (first == 1).mean():.2f}%")
print("Days with no touch:", list(d[first == 0].strftime("%Y-%m-%d")))
for n in [3, 6, 12, 18, 24, 36]:
    print(f"Touched by bar {n}: {100 * ((first > 0) & (first <= n)).mean():.1f}%")
print((pd.Series(first > 0, index=d).groupby(d.year).mean() * 100).round(2).to_string())   # share of days touched, by year

# Away from the EMA: the whole bar above it (low > EMA) or below it (high < EMA); consecutive bars form one streak, reset at each open
streaks, longest = {"above": [], "below": []}, []
for i in np.flatnonzero(use):
    best = 0
    for side, off in [("above", L[i] > ema[i]), ("below", H[i] < ema[i])]:
        run = 0
        for x in list(off) + [False]:                       # append a False so the last streak before the close is counted too
            if x:
                run += 1
            elif run:
                streaks[side].append(run)                   # a streak ended; record its length
                best = max(best, run)
                run = 0
    longest.append(best)
up, down = np.array(streaks["above"]), np.array(streaks["below"])
both, longest = np.r_[up, down], np.array(longest)
print(f"{len(both)} streaks away from the EMA ({len(up)} above, {len(down)} below), {len(both) / use.sum():.1f} a day on average")
print(f"Median length {np.median(both):.0f} bars, 20 bars or fewer {100 * (both <= 20).mean():.1f}%")
for n in [10, 20, 40]:
    print(f"At least {n} bars in a row: above {100 * (up >= n).mean():.1f}% ({(up >= n).sum()} streaks), below {100 * (down >= n).mean():.1f}% ({(down >= n).sum()} streaks)")
print(f"Days with at least one streak of 20+ bars: {100 * (longest >= 20).mean():.1f}%")
