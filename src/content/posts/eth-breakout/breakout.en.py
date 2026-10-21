# Overnight breakout: did today's RTH break today's overnight (ETH) high / low?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC)
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
df["date"] = t.dt.normalize()
is_rth = (hm >= 930) & (hm < 1615)                    # RTH 09:30–16:15

rth = df[is_rth].groupby("date").agg(hi=("high", "max"), lo=("low", "min"))
days = rth.index

# Overnight = previous trading day 16:15 to 09:29 today:
# bars after 16:15 belong to the next trading day, bars before 09:30 belong to today
eth = df[~is_rth]
anchor = eth.date + pd.to_timedelta((hm[~is_rth] >= 1615).astype(int), unit="D")
pos = days.searchsorted(anchor)
keep = pos < len(days)
night = (eth[keep].assign(day=days[pos[keep]])
         .groupby("day").agg(hi=("high", "max"), lo=("low", "min"), bars=("high", "size")))
night = night[night.bars >= 800]                      # skip days with an incomplete overnight session (< 800 bars)

today = rth.loc[night.index]
up = today.hi > night.hi                              # strictly above; equal doesn't count
down = today.lo < night.lo
cls = pd.Series(np.select([up & down, up, down], ["both sides", "up only", "down only"], "neither"), index=today.index)

print("sample days", len(cls))
print((cls.value_counts(normalize=True) * 100).round(1).to_string())
print("at least one side %.1f%%" % (100 * (cls != "neither").mean()))

# Overnight range width: divided by the average RTH range of the last 8 days (not including today), so it's known before the open
adr = (rth.hi - rth.lo).rolling(8).mean().shift(1).loc[night.index]
ok = adr.notna()                                      # the first 8 days of the data have no average range; skip them
width = ((night.hi - night.lo) / adr * 100)[ok]
groups = pd.cut(width, [0, 30, 40, 50, 60, 70, 80, 100, 120, np.inf], right=False)
print(f"\nOvernight width: {ok.sum()} days, median {width.median():.1f}%, middle half {width.quantile(0.25):.1f}%–{width.quantile(0.75):.1f}%")
tab = pd.crosstab(groups, cls[ok], normalize="index").mul(100).round(1)
tab["days"] = groups.value_counts().sort_index()
print(tab.to_string())
narrow, wide = cls[ok][width < 50], cls[ok][width >= 100]       # under half the average daily range / more than a full one
print(f"Overnight width < 50%: {len(narrow)} days, both sides {100 * (narrow == 'both sides').mean():.1f}%; "
      f">= 100%: {len(wide)} days, both sides {100 * (wide == 'both sides').mean():.1f}%, neither {100 * (wide == 'neither').mean():.1f}%")
