# 连续阳线 / 阴线之后：连涨（连跌）N 根以后，下一根收阳的概率
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC）
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

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "open", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute
# 日盘 K 线：09:30 开、16:15 收
rth = df[(m >= 570) & (m < 975)].groupby(t.dt.normalize()).agg(o=("open", "first"), c=("close", "last"))
# 全天 K 线：前一天 18:00 开、当天 17:00 收（18:00 以后的算下一个交易日）
full = df.groupby((t + pd.Timedelta(hours=6)).dt.normalize()).agg(o=("open", "first"), c=("close", "last"))
full = full.loc[rth.index[1:]]      # 只留有日盘的日子；数据第一天的夜盘不完整，去掉

# 日线的“连续”按股市交易日算：上一个交易日被清洗掉了，就从头数
cal = pd.bdate_range(rth.index.min() - pd.Timedelta(days=10), rth.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:])


def wilson(k, n, z=1.96):
    """比例的 95% 区间（Wilson 方法），样本少时比“比例 ± 2 倍标准误”更靠谱"""
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return f"{100 * (c - h):.1f}%–{100 * (c + h):.1f}%"


def study(bars, linked, name):
    d = np.sign(bars.c.values - bars.o.values).astype(int)   # 阳线 +1，阴线 −1，十字线 0
    streak = np.zeros(len(d), int)                            # 连涨 +1、+2……，连跌 −1、−2……
    for i, x in enumerate(d):
        same = i > 0 and linked[i] and x != 0 and np.sign(streak[i - 1]) == x
        streak[i] = streak[i - 1] + x if same else x
    rows = pd.DataFrame({"连续": streak[:-1], "下一根收阳": d[1:] > 0})[(d[1:] != 0) & linked[1:]]   # 下一根是十字线、或者不挨着的，不算
    rows["组"] = rows["连续"].clip(-8, 8)                     # 连续 8 根以上并成一组
    print(f"== {name}：{len(rows)} 次，不看前面下一根收阳 {100 * rows['下一根收阳'].mean():.1f}%")
    for lab, g in [("连涨 2 根以上", rows[rows["连续"] >= 2]), ("连跌 2 根以上", rows[rows["连续"] <= -2])]:
        print(f"{lab}：{len(g)} 次，下一根收阳 {100 * g['下一根收阳'].mean():.1f}%（95% 区间 {wilson(g['下一根收阳'].sum(), len(g))}）")
    tab = rows[rows["组"] != 0].groupby("组")["下一根收阳"].agg(["size", "mean", "sum"])
    tab["95% 区间"] = [wilson(k, n) for k, n in zip(tab["sum"], tab["size"])]
    tab.index = [f"连{'涨' if k > 0 else '跌'} {abs(k)}{'+' if abs(k) == 8 else ''} 根" for k in tab.index]
    print(tab.drop(columns="sum").rename(columns={"size": "次数", "mean": "下一根收阳"}).round(3).to_string())


for bars, name in [(rth, "日线 · 日盘"), (full, "日线 · 全天")]:
    study(bars, np.r_[False, prev.reindex(bars.index).values[1:] == bars.index.values[:-1]], name)
    wk = bars.index - pd.to_timedelta(bars.index.dayofweek, unit="D")              # 这周的周一
    w = bars.groupby(wk).agg(o=("o", "first"), c=("c", "last"))
    study(w, np.r_[False, np.diff(w.index.values) == np.timedelta64(7, "D")], name.replace("日线", "周线"))
