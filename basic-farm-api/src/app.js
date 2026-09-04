const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
const env = require("./config/env");
const requestLogger = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const routes = require("./routes");
const v1Routes = require("./routes/v1");

const app = express();

app.set("trust proxy", 1); // needed for correct req.ip behind Clever Cloud's proxy

app.use(requestLogger);
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

// Docs are public (mounted before v1Routes' requireApiKey), the actual
// /api/v1 resources below are not — matches basic-map's public-API split.
const openapiSpec = yaml.load(fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.yaml"), "utf8"));
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use("/api/v1", v1Routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
