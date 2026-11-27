# Бүх жишээг ажиллуулж гаралтыг out/ хавтсанд хадгална.
# Ажиллуулах (репогийн үндсэн хавтаснаас):  Rscript _tools/r-examples/run-all.R
ex  <- normalizePath("_tools/r-examples")
out <- file.path(ex, "out"); dir.create(out, showWarnings = FALSE)
setwd("resources/data")
for (f in list.files(ex, pattern = "\\.R$")) {
  if (f %in% c("run-all.R", "plots.R")) next
  slug <- sub("\\.R$", "", f)
  options(width = 78, digits = 7, warn = 1)
  set.seed(1)
  txt <- capture.output(
    tryCatch(source(file.path(ex, f), echo = TRUE, max.deparse.length = Inf, keep.source = TRUE,
                    spaced = FALSE, encoding = "UTF-8", prompt.echo = "> ", continue.echo = "+ ",
                    local = new.env()),
             error = function(e) cat("ERROR:", conditionMessage(e), "\n")),
    type = "output")
  writeLines(txt, file.path(out, paste0(slug, ".txt")), useBytes = TRUE)
  cat(slug, length(txt), "\n")
}
