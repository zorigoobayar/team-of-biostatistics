"""Сайтын жишээ өгөгдлийг (зохиомол) үүсгэнэ.
Ажиллуулах: python3 _tools/make-example-data.py
Гаралт: resources/data/emnelgiin-jishee.csv
"""
import csv, math, random

random.seed(2026)
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
    rows.append(dict(id=i, group=group, sex=sex, age=age, bmi=bmi, smoker=smoker,
                     city=city, sbp0=sbp0, sbp8=sbp8, pain0=pain0, pain6=pain6,
                     infection=infection, ari=ari, years=years,
                     time_months=time, event=event))

with open("resources/data/emnelgiin-jishee.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print(len(rows), "мөр бичлээ")
