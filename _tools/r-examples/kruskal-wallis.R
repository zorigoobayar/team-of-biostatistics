df <- read.csv("emnelgiin-jishee.csv", fileEncoding = "UTF-8-BOM")
aggregate(crp ~ city, data = df, FUN = function(x) c(n = length(x), median = median(x), IQR = IQR(x)))
kruskal.test(crp ~ city, data = df)
pairwise.wilcox.test(df$crp, df$city, p.adjust.method = "holm", exact = FALSE)
