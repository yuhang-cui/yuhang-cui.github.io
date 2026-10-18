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
