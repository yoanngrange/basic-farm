const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const requestLogger = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

const app = express();

app.set("trust proxy", 1); // needed for correct req.ip behind Clever Cloud's proxy

app.use(requestLogger);
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
