df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
library(geepack)
long <- reshape(df[, c("id", "group", "sbp0", "sbp4", "sbp8", "sbp12")],
                direction = "long", varying = c("sbp0", "sbp4", "sbp8", "sbp12"),
                v.names = "sbp", timevar = "week", times = c(0, 4, 8, 12), idvar = "id")
long <- long[!is.na(long$sbp), ]
long <- long[order(long$id, long$week), ]
long$group <- factor(long$group, levels = c("Плацебо", "Эм"))
long$ctrl <- as.integer(long$sbp < 140)                    # даралт хяналтад орсон эсэх
m <- geeglm(ctrl ~ group * week, id = id, family = binomial,
            corstr = "exchangeable", data = long)
summary(m)
round(exp(cbind(OR = coef(m), lower = coef(m) - 1.96 * sqrt(diag(vcov(m))),
                upper = coef(m) + 1.96 * sqrt(diag(vcov(m))))), 3)
