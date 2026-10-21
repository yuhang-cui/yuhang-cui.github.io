# 星期几效应：周一到周五，ES 日盘收阳的比例、涨跌幅、日内波幅有没有差别？
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
rth = df[(hm >= 930) & (hm < 1615)].assign(date=t.dt.normalize())   # 日盘 09:30–16:15
day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"),
                              contract=("instrument_id", "first"))

# 收盘对收盘：昨天 = 上一个股市交易日；昨天被清洗掉了、或者两天不是同一个合约，这一天不算
cal = pd.bdate_range(day.index.min() - pd.Timedelta(days=10), day.index.max())
cal = cal[~cal.isin(NYSE().holidays(cal.min(), cal.max()).union(CLOSED))]
prev = pd.Series(cal[:-1], index=cal[1:]).reindex(day.index)
linked = (prev.values[1:] == day.index.values[:-1]) & (day.contract.values[1:] == day.contract.values[:-1])

day["日盘"] = (day.c - day.o) / day.o * 100                                  # 日盘涨跌 %
day["收盘对收盘"] = np.r_[np.nan, np.where(linked, (day.c.values[1:] / day.c.values[:-1] - 1) * 100, np.nan)]
day["波幅"] = (day.h - day.l) / day.o * 100                                  # 日内波幅 %
day["星期"] = day.index.dayofweek                                            # 0 = 周一 … 4 = 周五


def wilson(k, n, z=1.96):
    """收阳比例的 95% 区间（Wilson 方法）"""
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return f"{100 * (c - h):.1f}–{100 * (c + h):.1f}"


def table(d):
    g = d.groupby("星期")
    tab = pd.DataFrame({
        "天数": g.size(),
        "日盘收阳%": g["日盘"].apply(lambda s: 100 * (s > 0).mean()),
        "95%区间": g["日盘"].apply(lambda s: wilson((s > 0).sum(), len(s))),
        "收盘对收盘上涨%": g["收盘对收盘"].apply(lambda s: 100 * (s.dropna() > 0).mean()),
        "收盘对收盘平均%": g["收盘对收盘"].mean(),
        "收盘对收盘中位数%": g["收盘对收盘"].median(),
        "波幅中位数%": g["波幅"].median(),
    }).round(3)
    tab.index = ["周一", "周二", "周三", "周四", "周五"]
    return tab


print(f"样本 {len(day)} 天；日盘收阳 {100 * (day['日盘'] > 0).mean():.1f}%，"
      f"收盘对收盘上涨 {100 * (day['收盘对收盘'].dropna() > 0).mean():.1f}%，波幅中位数 {day['波幅'].median():.2f}%")
print(table(day).to_string())
for a, b in [(2010, 2017), (2018, 2026)]:                                   # 前后两半分开看，检查是不是稳定
    print(f"\n{a}–{b}")
    print(table(day[(day.index.year >= a) & (day.index.year <= b)]).to_string())

# 周末、月末、季末：月末 = 每个月最后一个股市交易日（这一天被清洗掉的月份不算），季末 = 3、6、9、12 月的月末
last_day = pd.Series(cal, index=cal).groupby([cal.year, cal.month]).max()
day["月末"] = day.index.isin(last_day.values)
day["季末"] = day["月末"] & day.index.month.isin([3, 6, 9, 12])
print()
for name, m in [("所有日子", day.index == day.index), ("周五", day["星期"] == 4), ("月末", day["月末"]), ("季末", day["季末"])]:
    s = day[m]
    cc = s["收盘对收盘"].dropna()
    print(f"{name}：{len(s)} 天，日盘收阳 {100 * (s['日盘'] > 0).mean():.1f}%（95% 区间 {wilson((s['日盘'] > 0).sum(), len(s))}），"
          f"收盘对收盘上涨 {100 * (cc > 0).mean():.1f}%（95% 区间 {wilson((cc > 0).sum(), len(cc))}）")
print("\n收盘对收盘跌得最多的 5 天：")
print(day["收盘对收盘"].nsmallest(5).round(2).to_string())
