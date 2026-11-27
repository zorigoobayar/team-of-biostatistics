"""Сайтын жишээ өгөгдлийг (зохиомол) үүсгэнэ.
Ажиллуулах: python3 _tools/make-example-data.py
Гаралт: resources/data/emnelgiin-jishee.csv
"""
import csv, math, random

random.seed(2026)
r2 = random.Random(7)   # шинэ баганууд: хуучин баганын утгыг өөрчлөхгүйн тулд тусдаа генератор
rows = []
for i in range(1, 201):
    group = "Эм" if i % 2 else "Плацебо"
    drug = group == "Эм"
    sex = random.choice(["Эрэгтэй", "Эмэгтэй"])
    age = round(random.gauss(56, 10))
    bmi = round(random.gauss(27.5, 4), 1)
    smoker = "Тийм" if random.random() < (0.35 if sex == "Эрэгтэй" else 0.12) else "Үгүй"
    city = random.choices(["Улаанбаатар", "Эрдэнэт", "Дархан"], [0.6, 0.2, 0.2])[0]
    sbp0 = round(random.gauss(148, 12))
    sbp8 = round(sbp0 - (12 if drug else 4) - 0.1 * (age - 56) + random.gauss(0, 9))
    pain0 = min(10, max(0, round(random.gauss(6, 1.5))))
    pain6 = min(10, max(0, pain0 - round(random.expovariate(1 / (2.2 if drug else 1.0)))))
    lp = -2.2 + (-0.7 if drug else 0) + 0.03 * (age - 56) + (0.6 if smoker == "Тийм" else 0)
    infection = "Тийм" if random.random() < 1 / (1 + math.exp(-lp)) else "Үгүй"
    years = round(random.uniform(0.5, 2.0), 2)
    rate = math.exp(0.3 + (0.35 if city == "Улаанбаатар" else 0) + (0.3 if smoker == "Тийм" else 0))
    lam = rate * years * random.gammavariate(2, 0.5)          # хэт тархалттай
    ari = 0; p = math.exp(-lam); cdf = p; u = random.random()
    while u > cdf:
        ari += 1; p *= lam / ari; cdf += p
    hz = 0.02 * math.exp((-0.5 if drug else 0) + 0.04 * (age - 56))
    t_event = random.expovariate(hz)
    t_cens = random.uniform(12, 36)
    time = round(min(t_event, t_cens), 1)
    event = int(t_event <= t_cens)
    # --- Нэмэлт баганууд (2-р хувилбар) ---
    pain6 = min(10, max(0, pain6 + round(r2.gauss(0, 0.9))))   # өвдөлт заримдаа нэмэгдэж болно
    sbp4 = round(sbp0 - (7 if drug else 2) + r2.gauss(0, 8))
    sbp12 = round(sbp0 - (14 if drug else 5) - 0.1 * (age - 56) + r2.gauss(0, 9))
    if r2.random() < 0.08:
        sbp12 = ""                                             # 12 дахь долоо хоногт ирээгүй
    dbp0 = round(88 + 0.35 * (sbp0 - 148) + r2.gauss(0, 6))
    dbp8 = round(dbp0 - (6 if drug else 2) + 0.3 * (sbp8 - sbp0 + (12 if drug else 4)) + r2.gauss(0, 5))
    city_eff = {"Улаанбаатар": 0.25, "Эрдэнэт": 0.0, "Дархан": -0.15}[city]
    chol = round(4.6 + city_eff + 0.06 * (bmi - 27.5) + r2.gauss(0, 0.7), 2)
    crp = round(math.exp(0.6 + 1.6 * city_eff + r2.gauss(0, 0.8)), 1)
    pct = round(math.exp(-1.6 + (1.5 if infection == "Тийм" else 0) + r2.gauss(0, 0.75)), 2)
    sbp8_home = round(sbp8 - 2 + r2.gauss(0, 5.5))
    lvh_true = (sbp0 > 152) if r2.random() < 0.85 else (sbp0 <= 152)
    lvh_r1 = "Тийм" if (lvh_true if r2.random() < 0.9 else not lvh_true) else "Үгүй"
    lvh_r2 = "Тийм" if (lvh_true if r2.random() < 0.88 else not lvh_true) else "Үгүй"
    rows.append(dict(id=i, group=group, sex=sex, age=age, bmi=bmi, smoker=smoker,
                     city=city, sbp0=sbp0, sbp8=sbp8, pain0=pain0, pain6=pain6,
                     infection=infection, ari=ari, years=years,
                     time_months=time, event=event,
                     sbp4=sbp4, sbp12=sbp12, dbp0=dbp0, dbp8=dbp8, chol=chol, crp=crp,
                     pct=pct, sbp8_home=sbp8_home, lvh_r1=lvh_r1, lvh_r2=lvh_r2))

with open("resources/data/emnelgiin-jishee.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print(len(rows), "мөр бичлээ")
