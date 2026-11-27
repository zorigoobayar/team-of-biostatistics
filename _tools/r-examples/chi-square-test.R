df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
df$group <- factor(df$group, levels = c("Плацебо", "Эм"))
tab <- table(df$group, df$infection)
tab
round(prop.table(tab, margin = 1) * 100, 1)
chisq.test(tab)
fisher.test(tab)
