df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
library(lme4); library(lmerTest)
long <- reshape(df[, c("id", "group", "sbp0", "sbp4", "sbp8", "sbp12")],
                direction = "long", varying = c("sbp0", "sbp4", "sbp8", "sbp12"),
                v.names = "sbp", timevar = "week", times = c(0, 4, 8, 12), idvar = "id")
long$group <- factor(long$group, levels = c("Плацебо", "Эм"))
long <- long[!is.na(long$sbp), ]                          # дутуу хэмжилтийг хасна, хүнийг биш
m1 <- lmer(sbp ~ group * week + (1 | id), data = long)
summary(m1)
vc <- as.data.frame(VarCorr(m1))
vc$vcov[1] / sum(vc$vcov)                                  # ICC
