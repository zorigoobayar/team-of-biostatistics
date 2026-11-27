df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")

before <- ifelse(df$sbp0 < 140, "Хяналттай", "Хяналтгүй")
after  <- ifelse(df$sbp8 < 140, "Хяналттай", "Хяналтгүй")
tab <- table(Өмнө = before, Дараа = after)
tab
mcnemar.test(tab)
