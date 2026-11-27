# Аргын хуудасны графикуудыг images/methods/ хавтсанд үүсгэнэ.
# Ажиллуулах (репогийн үндсэн хавтаснаас):  Rscript _tools/r-examples/plots.R
suppressPackageStartupMessages({ library(survival); library(pROC); library(lme4) })
df <- read.csv("resources/data/emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
df$group <- factor(df$group, levels = c("Плацебо", "Эм"))
out <- "images/methods"; dir.create(out, showWarnings = FALSE, recursive = TRUE)

ink <- "#1a2233"; muted <- "#566074"; grid <- "#e6eaf2"
col_g <- c("Плацебо" = "#8a93a6", "Эм" = "#3b3fd6")
col_c <- c("Дархан" = "#b26300", "Улаанбаатар" = "#3b3fd6", "Эрдэнэт" = "#0b8478")
alpha <- function(col, a) adjustcolor(col, alpha.f = a)

fig <- function(name, expr, w = 1600, h = 950) {
  png(file.path(out, paste0(name, ".png")), width = w, height = h, res = 200, type = "cairo")
  par(family = "sans", mar = c(4.2, 4.4, 2.6, 1), mgp = c(2.6, 0.7, 0), las = 1,
      col.axis = muted, col.lab = ink, col.main = ink, fg = muted, bty = "n",
      cex.main = 1.05, font.main = 2, tcl = -0.3)
  expr; dev.off()
}
hgrid <- function() abline(h = axTicks(2), col = grid, lwd = 1)
strip <- function(y, g, cols) {
  set.seed(3); x <- as.integer(g) + runif(length(y), -0.18, 0.18)
  points(x, y, pch = 16, cex = 0.6, col = alpha(cols[as.character(g)], 0.45))
}

fig("one-sample-t-test", {
  h <- hist(df$bmi, breaks = 20, plot = FALSE)
  plot(h, col = alpha("#3b3fd6", 0.25), border = "white", main = "БЖИ-ийн тархалт (n = 200)",
       xlab = "БЖИ (кг/м²)", ylab = "Хүний тоо")
  abline(v = 25, lwd = 2, lty = 2, col = "#cc2f4c"); abline(v = mean(df$bmi), lwd = 2.5, col = "#3b3fd6")
  legend("topright", c("Жишиг утга 25", sprintf("Дундаж %.1f", mean(df$bmi))),
         lwd = c(2, 2.5), lty = c(2, 1), col = c("#cc2f4c", "#3b3fd6"), bty = "n", cex = 0.85)
})

fig("independent-t-test", {
  boxplot(sbp8 ~ group, data = df, col = alpha(col_g, 0.2), border = col_g, lwd = 1.5,
          outline = FALSE, main = "8 дахь долоо хоногийн систолын даралт", xlab = "", ylab = "мм м.у.б",
          ylim = range(df$sbp8))
  strip(df$sbp8, df$group, col_g)
  m <- tapply(df$sbp8, df$group, mean); points(1:2, m, pch = 23, bg = "white", col = ink, cex = 1.4, lwd = 2)
  text(1:2, m, sprintf("%.1f", m), pos = 4, offset = 1.2, col = ink, cex = 0.85, font = 2)
})

fig("paired-t-test", {
  d <- df$sbp8 - df$sbp0
  h <- hist(d, breaks = 20, plot = FALSE)
  plot(h, col = alpha("#3b3fd6", 0.25), border = "white", main = "Даралтын өөрчлөлт: 8 дахь долоо хоног − эхэн",
       xlab = "Зөрүү (мм м.у.б)", ylab = "Хүний тоо")
  abline(v = 0, lwd = 2, lty = 2, col = muted); abline(v = mean(d), lwd = 2.5, col = "#3b3fd6")
  legend("topleft", c("Өөрчлөлтгүй (0)", sprintf("Дундаж зөрүү %.1f", mean(d))), lwd = c(2, 2.5),
         lty = c(2, 1), col = c(muted, "#3b3fd6"), bty = "n", cex = 0.85)
})

fig("anova", {
  df$city <- factor(df$city, levels = names(col_c))
  boxplot(chol ~ city, data = df, col = alpha(col_c, 0.18), border = col_c, lwd = 1.5, outline = FALSE,
          main = "Хотоор: нийт холестерин", xlab = "", ylab = "ммоль/л", ylim = range(df$chol))
  strip(df$chol, df$city, col_c)
  m <- tapply(df$chol, df$city, mean); points(1:3, m, pch = 23, bg = "white", col = ink, cex = 1.4, lwd = 2)
})

fig("ancova", {
  plot(df$sbp0, df$sbp8, pch = 16, cex = 0.7, col = alpha(col_g[as.character(df$group)], 0.5),
       main = "Эхний ба 8 дахь долоо хоногийн даралт", xlab = "Эхний даралт (мм м.у.б)",
       ylab = "8 дахь долоо хоногийн даралт")
  m <- lm(sbp8 ~ sbp0 + group, data = df); b <- coef(m); xs <- range(df$sbp0)
  lines(xs, b[1] + b[2] * xs, col = col_g[1], lwd = 2.5)
  lines(xs, b[1] + b[3] + b[2] * xs, col = col_g[2], lwd = 2.5)
  legend("topleft", names(col_g), col = col_g, lwd = 2.5, pch = 16, bty = "n", cex = 0.85)
})

fig("manova", {
  plot(df$sbp8, df$dbp8, pch = 16, cex = 0.7, col = alpha(col_g[as.character(df$group)], 0.5),
       main = "Систол ба диастол даралт (8 дахь долоо хоног)", xlab = "Систол (мм м.у.б)", ylab = "Диастол (мм м.у.б)")
  for (g in levels(df$group)) { s <- df[df$group == g, ]
    points(mean(s$sbp8), mean(s$dbp8), pch = 23, bg = col_g[g], col = "white", cex = 2, lwd = 2) }
  legend("topleft", c(names(col_g), "◆ бүлгийн дундаж"), col = c(col_g, ink), pch = c(16, 16, NA),
         bty = "n", cex = 0.85)
})

fig("chi-square-test", {
  p <- tapply(df$infection == "Тийм", df$group, mean) * 100
  b <- barplot(p, col = col_g, border = NA, ylim = c(0, 25), main = "Хүндрэлийн халдвар гарсан хувь",
               ylab = "%", names.arg = paste0(names(p), "\n(n = 100)"), mgp = c(2.6, 1.6, 0))
  text(b, p, sprintf("%.0f%%", p), pos = 3, font = 2, col = ink)
})

fig("mcnemar-test", {
  p <- c(mean(df$sbp0 < 140), mean(df$sbp8 < 140)) * 100
  b <- barplot(p, col = c("#8a93a6", "#3b3fd6"), border = NA, ylim = c(0, 70), ylab = "%",
               names.arg = c("Эхэнд", "8 дахь долоо хоногт"), main = "Даралт хяналтад (<140) орсон хувь, n = 200")
  text(b, p, sprintf("%.0f%%", p), pos = 3, font = 2, col = ink)
})

fig("mann-whitney", {
  tb <- prop.table(table(df$group, factor(df$pain6, levels = 0:10)), 1) * 100
  barplot(tb, beside = TRUE, col = col_g, border = NA, main = "6 дахь долоо хоногийн өвдөлтийн оноо",
          xlab = "Өвдөлтийн оноо (0–10)", ylab = "Бүлгийн %")
  legend("topright", names(col_g), fill = col_g, border = NA, bty = "n", cex = 0.85)
})

fig("wilcoxon-signed-rank", {
  d <- factor(df$pain6 - df$pain0, levels = -7:3)
  b <- barplot(table(d), col = ifelse(as.integer(levels(d)) < 0, "#3b3fd6", ifelse(levels(d) == "0", "#8a93a6", "#cc2f4c")),
               border = NA, main = "Өвдөлтийн өөрчлөлт: 6 дахь долоо хоног − эхэн", xlab = "Зөрүү (оноо)", ylab = "Хүний тоо")
})

fig("kruskal-wallis", {
  df$city <- factor(df$city, levels = names(col_c))
  boxplot(crp ~ city, data = df, log = "y", col = alpha(col_c, 0.18), border = col_c, lwd = 1.5,
          outline = FALSE, main = "Хотоор: CRP (лог шкал)", xlab = "", ylab = "CRP (мг/л)", ylim = range(df$crp))
  strip(df$crp, df$city, col_c)
})

fig("correlation", {
  plot(df$bmi, df$chol, pch = 16, cex = 0.75, col = alpha("#3b3fd6", 0.5), main = "БЖИ ба нийт холестерин",
       xlab = "БЖИ (кг/м²)", ylab = "Холестерин (ммоль/л)")
  abline(lm(chol ~ bmi, df), lwd = 2.5, col = "#cc2f4c")
  legend("topleft", sprintf("r = %.2f", cor(df$bmi, df$chol)), bty = "n", text.font = 2)
})

fig("linear-regression", {
  m <- lm(sbp8 ~ group + age + sbp0 + bmi, data = df)
  par(mfrow = c(1, 2))
  plot(fitted(m), resid(m), pch = 16, cex = 0.6, col = alpha("#3b3fd6", 0.5), main = "Үлдэгдэл ба таамаг утга",
       xlab = "Таамаг утга", ylab = "Үлдэгдэл"); abline(h = 0, lty = 2, col = muted)
  lines(lowess(fitted(m), resid(m)), col = "#cc2f4c", lwd = 2)
  qqnorm(resid(m), pch = 16, cex = 0.6, col = alpha("#3b3fd6", 0.5), main = "Үлдэгдлийн Q-Q график",
         xlab = "Онолын квантиль", ylab = "Ажиглагдсан квантиль"); qqline(resid(m), col = "#cc2f4c", lwd = 2)
}, w = 1800)

forest <- function(est, lo, hi, labs, main, xlab) {
  k <- length(est); y <- k:1
  plot(est, y, xlim = range(c(lo, hi, 1)), ylim = c(0.5, k + 0.5), log = "x", yaxt = "n", pch = 15,
       cex = 1.6, col = "#3b3fd6", main = main, xlab = xlab, ylab = "")
  abline(v = 1, lty = 2, col = muted); segments(lo, y, hi, y, lwd = 2.5, col = "#3b3fd6")
  axis(2, at = y, labels = labs, tick = FALSE, col.axis = ink)
  text(est, y, sprintf("%.2f (%.2f; %.2f)", est, lo, hi), pos = 3, cex = 0.75, col = ink)
}

fig("logistic-regression", {
  df$smoker <- factor(df$smoker, levels = c("Үгүй", "Тийм")); df$inf01 <- as.integer(df$infection == "Тийм")
  m <- glm(inf01 ~ group + age + smoker, family = binomial, data = df)
  ci <- exp(suppressMessages(confint(m)))[-1, ]; or <- exp(coef(m))[-1]
  par(mar = c(4.2, 11.5, 2.6, 1.5))
  forest(or, ci[, 1], ci[, 2], c("Эм (плацебо-той)", "Нас (+1 жил)", "Тамхи татдаг"),
         "Хүндрэлийн халдварын OR, 95% CI", "Odds ratio (лог шкал)")
})

fig("poisson-regression", {
  tb <- table(factor(df$ari, levels = 0:max(df$ari)))
  lam <- mean(df$ari); exp_p <- dpois(0:max(df$ari), lam) * nrow(df)
  b <- barplot(tb, col = alpha("#3b3fd6", 0.3), border = NA, main = "Халдварын тоо: ажиглагдсан ба Пуассоны хүлээгдэх",
               xlab = "Амьсгалын замын халдварын тоо", ylab = "Хүний тоо", ylim = c(0, max(tb, exp_p) * 1.15))
  lines(b, exp_p, type = "b", pch = 16, col = "#cc2f4c", lwd = 2)
  legend("topright", c("Ажиглагдсан", "Пуассон (дундаж = дисперс)"), fill = c(alpha("#3b3fd6", 0.3), NA),
         border = NA, col = c(NA, "#cc2f4c"), lwd = c(NA, 2), pch = c(NA, 16), bty = "n", cex = 0.85)
})

fig("survival-analysis", {
  km <- survfit(Surv(time_months, event) ~ group, data = df)
  plot(km, col = col_g, lwd = 2.5, conf.int = FALSE, mark.time = TRUE, xlab = "Хугацаа (сар)",
       ylab = "Үйл явдалгүй байх магадлал", main = "Каплан-Майерийн муруй", ylim = c(0, 1), xaxt = "n")
  axis(1, at = seq(0, 36, 6))
  abline(v = c(12, 24), col = grid, lty = 3)
  legend("bottomleft", c("Плацебо", "Эм"), col = col_g, lwd = 2.5, bty = "n", cex = 0.85)
})

fig("cox-regression", {
  m <- coxph(Surv(time_months, event) ~ group + age + sex, data = df); s <- summary(m)$conf.int
  par(mar = c(4.2, 11.5, 2.6, 1.5))
  forest(s[, 1], s[, 3], s[, 4], c("Эм (плацебо-той)", "Нас (+1 жил)", "Эрэгтэй (эмэгтэйтэй)"),
         "Hazard ratio, 95% CI", "HR (лог шкал)")
})

long <- reshape(df[, c("id", "group", "sbp0", "sbp4", "sbp8", "sbp12")], direction = "long",
                varying = c("sbp0", "sbp4", "sbp8", "sbp12"), v.names = "sbp", timevar = "week",
                times = c(0, 4, 8, 12), idvar = "id")
long <- long[!is.na(long$sbp), ]

fig("repeated-measures-anova", {
  full <- long[long$id %in% df$id[!is.na(df$sbp12)], ]
  plot(NA, xlim = c(-0.5, 12.5), ylim = c(130, 152), xaxt = "n", xlab = "Долоо хоног", ylab = "Дундаж даралт (мм м.у.б)",
       main = "Бүлэг тус бүрийн дундаж даралт ба 95% CI"); axis(1, at = c(0, 4, 8, 12)); hgrid()
  for (g in levels(df$group)) { s <- full[full$group == g, ]
    mu <- tapply(s$sbp, s$week, mean); se <- tapply(s$sbp, s$week, function(x) sd(x) / sqrt(length(x)))
    x <- c(0, 4, 8, 12) + ifelse(g == "Эм", 0.15, -0.15)
    arrows(x, mu - 1.96 * se, x, mu + 1.96 * se, angle = 90, code = 3, length = 0.04, col = col_g[g], lwd = 1.5)
    lines(x, mu, type = "b", pch = 16, col = col_g[g], lwd = 2.5) }
  legend("bottomleft", names(col_g), col = col_g, lwd = 2.5, pch = 16, bty = "n", cex = 0.85)
})

fig("mixed-models", {
  long$group <- factor(long$group, levels = c("Плацебо", "Эм"))
  m <- lmer(sbp ~ group * week + (1 | id), data = long)
  plot(NA, xlim = c(0, 12), ylim = c(105, 190), xaxt = "n", xlab = "Долоо хоног", ylab = "Даралт (мм м.у.б)",
       main = "Хувь хүний шугам (нимгэн) ба загварын дундаж (зузаан)"); axis(1, at = c(0, 4, 8, 12))
  set.seed(5); ids <- sample(unique(long$id), 40)
  for (i in ids) { s <- long[long$id == i, ]; lines(s$week, s$sbp, col = alpha(col_g[as.character(s$group[1])], 0.35)) }
  b <- fixef(m); xs <- c(0, 12)
  lines(xs, b[1] + b[3] * xs, col = col_g[1], lwd = 4); lines(xs, b[1] + b[2] + (b[3] + b[4]) * xs, col = col_g[2], lwd = 4)
  legend("topright", names(col_g), col = col_g, lwd = 4, bty = "n", cex = 0.85)
})

fig("gee", {
  long$ctrl <- long$sbp < 140
  plot(NA, xlim = c(-0.5, 12.5), ylim = c(0, 80), xaxt = "n", xlab = "Долоо хоног", ylab = "%",
       main = "Даралт хяналтад (<140) орсон хувь"); axis(1, at = c(0, 4, 8, 12)); hgrid()
  for (g in levels(df$group)) { s <- long[long$group == g, ]; p <- tapply(s$ctrl, s$week, mean) * 100
    lines(c(0, 4, 8, 12), p, type = "b", pch = 16, col = col_g[g], lwd = 2.5)
    text(12, p[4], sprintf("%.0f%%", p[4]), pos = 4, cex = 0.8, col = col_g[g], xpd = NA) }
  legend("topleft", names(col_g), col = col_g, lwd = 2.5, pch = 16, bty = "n", cex = 0.85)
})

fig("diagnostic-accuracy", {
  r <- roc(infection ~ pct, data = df, levels = c("Үгүй", "Тийм"), direction = "<", quiet = TRUE)
  par(pty = "s")
  plot(1 - r$specificities, r$sensitivities, type = "s", lwd = 2.5, col = "#3b3fd6", xlim = c(0, 1), ylim = c(0, 1),
       xlab = "1 − өвөрмөц чанар", ylab = "Мэдрэг чанар", main = sprintf("Прокальцитонины ROC муруй, AUC = %.3f", auc(r)))
  abline(0, 1, lty = 2, col = muted)
  bc <- coords(r, "best", best.method = "youden", ret = c("specificity", "sensitivity", "threshold"))
  points(1 - bc$specificity, bc$sensitivity, pch = 21, bg = "#cc2f4c", col = "white", cex = 1.8)
  text(1 - bc$specificity, bc$sensitivity, sprintf("  таслах цэг %.2f", bc$threshold), pos = 4, cex = 0.8)
}, w = 1300, h = 1150)

fig("reliability", {
  a <- (df$sbp8_home + df$sbp8) / 2; d <- df$sbp8_home - df$sbp8; m <- mean(d); s <- sd(d)
  plot(a, d, pch = 16, cex = 0.7, col = alpha("#3b3fd6", 0.5), main = "Bland–Altman: гэрийн − эмнэлгийн даралт",
       xlab = "Хоёр хэмжилтийн дундаж (мм м.у.б)", ylab = "Зөрүү (мм м.у.б)", ylim = c(-25, 20))
  abline(h = m, lwd = 2.5, col = "#3b3fd6"); abline(h = m + c(-1.96, 1.96) * s, lwd = 2, lty = 2, col = "#cc2f4c")
  text(max(a), c(m, m - 1.96 * s, m + 1.96 * s), sprintf(c("дундаж %.1f", "−1.96 SD: %.1f", "+1.96 SD: %.1f"),
       c(m, m - 1.96 * s, m + 1.96 * s)), pos = 3, cex = 0.75, adj = 1, xpd = NA)
})

fig("sample-size", {
  n <- 10:150; pw <- sapply(n, function(k) power.t.test(n = k, delta = 8, sd = 15)$power)
  plot(n, pw, type = "l", lwd = 2.5, col = "#3b3fd6", ylim = c(0, 1), xlab = "Бүлэг бүрийн хүний тоо (n)",
       ylab = "Статистик чадал", main = "Чадлын муруй: зөрүү 8, SD 15, α = 0.05"); hgrid()
  abline(h = c(0.8, 0.9), lty = 2, col = c(muted, "#cc2f4c"))
  n90 <- ceiling(power.t.test(delta = 8, sd = 15, power = 0.9)$n); n80 <- ceiling(power.t.test(delta = 8, sd = 15, power = 0.8)$n)
  points(c(n80, n90), c(0.8, 0.9), pch = 16, col = c(muted, "#cc2f4c"), cex = 1.4)
  text(c(n80, n90), c(0.8, 0.9), c(paste0("80% → n = ", n80), paste0("90% → n = ", n90)), pos = 4, cex = 0.8)
})
cat("done\n")
