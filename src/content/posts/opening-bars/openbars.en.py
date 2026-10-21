# Consecutive same-color bars at the open: when the first N RTH bars are all bull (bear) bars, how does the day close?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC)
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # minutes since 09:30
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), m=m)   # RTH 09:30–16:15

day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"))
print(f"Sample {len(day)} days, closed up {100 * (day.c > day.o).mean():.1f}%, closed down {100 * (day.c < day.o).mean():.1f}%")

for T in [5, 15, 30, 60]:                                   # bar size (a short last bar still counts, e.g. 15:30–16:15 on the 60-minute chart)
    k = rth.assign(k=rth.m // T).groupby(["date", "k"])
    bars = k.agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"))
    color = np.sign(bars.c - bars.o).unstack()              # one row per day: is bar 1, 2, 3, … bull (+1) or bear (−1)
    hi = bars.h.unstack().cummax(axis=1)                    # highest high up to bar N
    lo = bars.l.unstack().cummin(axis=1)
    close = bars.c.unstack()
    for N in range(1, (8 if T <= 15 else 6) + 1):            # same as the interactive chart: up to bar 8 for 5 and 15 minutes, bar 6 for 30 and 60
        for s, name in [(1, "bull"), (-1, "bear")]:
            sig = (color.iloc[:, :N] == s).all(axis=1)      # the first N bars are all bull (bear) bars
            d = day[sig]
            sig_close = close.iloc[:, N - 1][sig]           # signal close = the close of bar N
            hiN, loN = hi.iloc[:, N - 1][sig], lo.iloc[:, N - 1][sig]
            if s > 0:
                same = d.c > d.o                             # the day closes up
                beyond = d.c > sig_close                     # closes above the signal close: buying at bar N's close would be profitable at the close
                opp = loN == d.l                             # the low of the day is already inside the first N bars
                more = d.h > hiN                             # price makes a new high later
            else:
                same, beyond, opp, more = d.c < d.o, d.c < sig_close, hiN == d.h, d.l < loN
            print(f"{T:2d} min, first {N} bar{'s' if N > 1 else ''} all {name}: {sig.sum():4d} days ({100 * sig.mean():.1f}%)"
                  f"  day same color {100 * same.mean():.1f}%  close beyond signal close {100 * beyond.mean():.1f}%"
                  f"  opposite extreme already in {100 * opp.mean():.1f}%  new {'high' if s > 0 else 'low'} later {100 * more.mean():.1f}%")

# First 6 sixty-minute bars all bull: after bar 6 closes at 15:30, what happens in the last 45 minutes
k = rth.assign(k=rth.m // 60).groupby(["date", "k"])
h60 = k.agg(o=("open", "first"), c=("close", "last"))
color, close = np.sign(h60.c - h60.o).unstack(), h60.c.unstack()
six = (color.iloc[:, :6] == 1).all(axis=1)
d, c6 = day[six], close.iloc[:, 5][six]
tail = (d.c - c6) / c6 * 100                                # change from 15:30 to the close, in %
print(f"\nFirst 6 sixty-minute bars all bull: {six.sum()} days; closed above 15:30 {100 * (tail > 0).mean():.1f}%, "
      f"fell more than 0.3% into the close on {(tail < -0.3).sum()} days; median distance from the close to the day's high {100 * ((d.h - d.c) / (d.h - d.l)).median():.0f}% of the day's range")
