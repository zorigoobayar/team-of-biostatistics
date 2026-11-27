df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
long <- reshape(df[, c("id", "group", "sbp0", "sbp4", "sbp8", "sbp12")],
                direction = "long", varying = c("sbp0", "sbp4", "sbp8", "sbp12"),
                v.names = "sbp", timevar = "week", times = c(0, 4, 8, 12), idvar = "id")
long$week <- factor(long$week)
full <- long[long$id %in% df$id[!is.na(df$sbp12)], ]     # бүрэн өгөгдөлтэй хүмүүс
m <- afex::aov_ez(id = "id", dv = "sbp", within = "week", between = "group", data = full)
m
summary(m)$sphericity.tests
