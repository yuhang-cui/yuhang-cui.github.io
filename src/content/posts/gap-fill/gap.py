# 缺口回补：上周（昨天）的收盘价，这周（今天）有没有被碰回来
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC，含 instrument_id 列）
import numpy as np
import pandas as pd
from pandas.tseries.holiday import (
    AbstractHolidayCalendar, Holiday, GoodFriday, USMartinLutherKingJr, USPresidentsDay,
    USMemorialDay, USLaborDay, USThanksgivingDay, nearest_workday, sunday_to_monday,
)


class NYSE(AbstractHolidayCalendar):  # 纽交所全天休市日
    rules = [
        Holiday("元旦", month=1, day=1, observance=sunday_to_monday),
        USMartinLutherKingJr, USPresidentsDay, GoodFriday, USMemorialDay,
        Holiday("六月节", month=6, day=19, start_date="2022-01-01", observance=nearest_workday),
        Holiday("独立日", month=7, day=4, observance=nearest_workday),
        USLaborDay, USThanksgivingDay,
        Holiday("圣诞节", month=12, day=25, observance=nearest_workday),
    ]


CLOSED = pd.to_datetime(["2012-10-29", "2012-10-30", "2018-12-05", "2025-01-09"])  # 临时休市
EDGES = [0, 5, 10, 15, 20, 30, 50, 100, np.inf]                                   # 缺口大小分档（% 平均波幅）

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "instrument_id", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize(), h1=hm < 1030)   # 日盘 09:30–16:15
g = rth.groupby("date")
day = g.agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"), inst=("instrument_id", "first"))
first_hour = rth[rth.h1].groupby("date").agg(h=("high", "max"), l=("low", "min"))  # 开盘第一个小时 09:30–10:30


def report(name, gaps):
    gaps["档"] = pd.cut(gaps["大小"], EDGES, right=False)
    print(f"== {name}：{len(gaps)} 个缺口，当期碰回 {100 * gaps['碰回'].mean():.1f}%，"
          f"其中一开始就碰回 {100 * gaps['一开始'].mean():.1f}%")
    by_dir = gaps.groupby("向上")["碰回"].mean() * 100
    print(f"向上缺口 {by_dir[True]:.1f}%，向下缺口 {by_dir[False]:.1f}%")
    print(gaps.groupby("档", observed=True).agg(缺口=("碰回", "size"), 碰回=("碰回", "mean"), 一开始=("一开始", "mean")).round(3).to_string())


# —— 周线：这周开盘价 vs 上周收盘价 ——
day["wk"] = day.index - pd.to_timedelta(day.index.dayofweek, unit="D")   # 这周的周一
weeks = []
for wk, d in day.groupby("wk"):
    d = d[d.inst == d.inst.iloc[0]]          # 一周中间换了合约的话，换约以后的几天不看
    weeks.append(dict(wk=wk, d=d, o=d.o.iloc[0], c=d.c.iloc[-1], rng=d.h.max() - d.l.min(),
                      i0=d.inst.iloc[0], i1=d.inst.iloc[-1]))
rows = []
for i in range(8, len(weeks)):
    a, b = weeks[i - 1], weeks[i]
    if (b["wk"] - a["wk"]).days != 7 or a["i1"] != b["i0"]:
        continue                             # 上周缺失，或者两周不是同一个合约
    gap = b["o"] - a["c"]
    if gap == 0:
        continue
    abr = np.mean([w["rng"] for w in weeks[i - 8:i]])   # 过去 8 周平均每周的波幅
    hit = (b["d"].l <= a["c"]) if gap > 0 else (b["d"].h >= a["c"])   # 哪几天碰到了上周收盘价
    rows.append({"向上": gap > 0, "大小": abs(gap) / abr * 100, "碰回": hit.any(), "一开始": hit.iloc[0]})
report("周线", pd.DataFrame(rows))

# —— 日线：今天开盘价 vs 昨天收盘价（昨天 = 上一个股市交易日）——
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
adr = (day.h - day.l).rolling(8).mean().shift(1)        # 过去 8 天平均每天的波幅
rows = []
for i in range(8, len(day)):
    today, yday = day.iloc[i], day.iloc[i - 1]
    if prev.iloc[i] != day.index[i - 1] or today.inst != yday.inst:
        continue                             # 昨天被清洗掉了，或者两天不是同一个合约
    gap = today.o - yday.c
    if gap == 0:
        continue
    fh = first_hour.loc[day.index[i]]
    up = gap > 0
    rows.append({"向上": up, "大小": abs(gap) / adr.iloc[i] * 100,
                 "碰回": today.l <= yday.c if up else today.h >= yday.c,
                 "一开始": fh.l <= yday.c if up else fh.h >= yday.c})
report("日线", pd.DataFrame(rows))
