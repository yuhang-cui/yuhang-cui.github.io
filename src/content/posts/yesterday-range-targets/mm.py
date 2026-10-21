# 今天能走出昨日区间几倍：用昨天日盘的区间当尺子，从昨日高点往上量、从昨日低点往下量
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

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "instrument_id", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
hm = t.dt.hour * 100 + t.dt.minute
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())  # 日盘 09:30–16:15
day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"),
                              contract=("instrument_id", "first"))

# 昨天 = 上一个股市交易日；昨天被清洗掉了、或者两天不是同一个合约的，跳过（和“突破昨日高低点”那篇一样）
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
today = day[prev.isin(day.index)]
yday = day.loc[prev[today.index]].set_index(today.index)
same = today.contract == yday.contract
today, yday = today[same], yday[same]

# 换成跳动单位（0.25 点）的整数来比较，避免小数误差
tick = lambda x: np.round(x * 4).astype(int)
R = tick(yday.h - yday.l)                                   # 昨日区间
up = tick(today.h - yday.h)                                 # 今天最高价比昨日高点高了多少
dn = tick(yday.l - today.l)                                 # 今天最低价比昨日低点低了多少


def hit(x, k):
    """走到 k 倍昨日区间：0 倍要严格突破（至少 1 个跳动单位），k > 0 要求 x ≥ k × R"""
    return x > 0 if k == 0 else x * 20 >= round(k * 20) * R


print(f"样本 {len(R)} 天")
for k in [0, 0.5, 0.8, 1, 2]:
    u, d = hit(up, k), hit(dn, k)
    print(f"{k} 倍：向上 {100 * u.mean():.1f}%  向下 {100 * d.mean():.1f}%  至少一边 {100 * (u | d).mean():.1f}%")

# 从几倍开始，向下走到的比例超过向上（每 0.05 倍看一次）
cross = next(k / 20 for k in range(1, 41) if hit(dn, k / 20).mean() > hit(up, k / 20).mean())
print(f"从 {cross} 倍开始，向下比向上多")
# 突破以后走满 1 倍的比例：只看向上（向下）突破了昨日高点（低点）的日子
print(f"向上突破的日子里走满 1 倍 {100 * hit(up, 1)[hit(up, 0)].mean():.1f}%，向下突破的日子里 {100 * hit(dn, 1)[hit(dn, 0)].mean():.1f}%")

# 分组：昨天收阳 / 收阴；昨天收在区间的哪三分之一；今天开在昨日区间的哪里
ibs = (yday.c - yday.l) / (yday.h - yday.l)                # 昨天收盘在区间里的位置，0 = 最低，1 = 最高
loc = (today.o - yday.l) / (yday.h - yday.l)               # 今天开盘在昨日区间里的位置，> 1 是开在昨日高点之上
groups = {
    "昨天收阳": yday.c > yday.o, "昨天收阴": yday.c < yday.o,
    "收在上 1/3": ibs >= 2 / 3, "收在中间": (ibs > 1 / 3) & (ibs < 2 / 3), "收在下 1/3": ibs <= 1 / 3,
    "开在昨日高点之上": loc > 1, "开在区间上 1/3": (loc >= 2 / 3) & (loc <= 1), "开在区间中间": (loc > 1 / 3) & (loc < 2 / 3),
    "开在区间下 1/3": (loc >= 0) & (loc <= 1 / 3), "开在昨日低点之下": loc < 0,
}
flags = pd.DataFrame({"0.5 倍 上": hit(up, 0.5), "0.5 倍 下": hit(dn, 0.5), "1 倍 上": hit(up, 1), "1 倍 下": hit(dn, 1),
                      "0 倍 至少一边": hit(up, 0) | hit(dn, 0), "0.5 倍 至少一边": hit(up, 0.5) | hit(dn, 0.5), "1 倍 至少一边": hit(up, 1) | hit(dn, 1)})
rows = {}
for name, m in groups.items():
    rows[name] = {"天数": m.sum(), **flags[m].mean()}
print(pd.DataFrame(rows).T.round(3).to_string())
