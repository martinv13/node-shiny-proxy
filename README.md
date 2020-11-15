# node-shiny-proxy

`node-shiny-proxy` is a simple way to deploy R Shiny apps. It runs some instances of your Shiny app(s) using `Rscript` on your system and sets up a reverse proxy to expose them to your users. It relies on the popular [`http-proxy`](https://github.com/http-party/node-http-proxy) and [`http-proxy-middleware`](https://github.com/chimurai/http-proxy-middleware) for proxying. As a pure Node.js solution it is platform-independent.

It is intended mainly as a proof of concept deployment option; for more robust solution you should go to Rstudio's [Shiny Server](https://rstudio.com/products/shiny/shiny-server/) or to [ShinyProxy](https://www.shinyproxy.io/). However, depending on your needs, you may find some of its features useful:

* it runs several instances of your Shiny apps to overcome the single-process limitation of the free version of Shiny Server,
* it works cross-platform (where R and Node.js run) and does not rely on Java or Docker as ShinyProxy does,
* it basically a middleware for a Node.js [Express](https://expressjs.com) application, so it can be extended easily to suit your needs (authentication, etc.),
* it can host different Shiny apps at "nested" paths (for instance one app at `/` and another at `/some-app`).

## Installation

```
npm install --save shiny-proxy
```

## Simple example

The following example will serve two Shiny apps located in the `shiny-apps/main-app` and `shiny-apps/my-app`folders:

``` javascript

import express from 'express';
import ShinyProxy from 'shiny-proxy';

const shinyProxy = new ShinyProxy({
    portRangeStart: 4000,
    apps: [
        {
            id: 'main-app',
            path: '/',
            appDir: 'shiny-apps/main-app'
        },
        {
            id: 'my-app',
            path: '/my-app',
            appDir: 'shiny-apps/my-app'
        }
    ]
});

const app = express();

app.use(shinyProxy.middleware);

app.listen(3000);

```

## Options

A `shiny-proxy` object is created with `new ShinyProxy(options)`. This section described available options.

#### Main settings

* **options.portRangeStart:** the start of the port range to serve Shiny apps instances on `localhost` (defaults to 4000). Shiny apps instances will be served on available tcp ports starting from there.

* **options.RscriptPath:** the path to `Rscript` executable (by default, `/usr/lib/R/bin/Rscript`).

* **options.redirect404:** the path to redirect "page not found" errors to (by default, `/404`).

* **options.redirect500:** the path to redirect "internal server errors" to (by default, `/500`). On error, `shiny-proxy` will try to launch new instance of your apps.

* **options.apps:** an array of Shiny apps settings.

#### Apps settings

* **options.apps[i].id:** a unique string identifier for the Shiny app.

* **options.apps[i].path:** the path to serve the Shiny app on.

* **options.apps[i].appDir:** the path of the folder containing the Shiny app (with either `app.R` or `server.R` and `ui.R`).

* **options.apps[i].workers:** the number of instances of the app to run (by default 2).

## License

MIT License (MIT)