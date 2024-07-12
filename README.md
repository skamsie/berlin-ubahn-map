# berlin-ubahn-map

https://ubahn-map.com/

An interactive way of displaying the Berlin Ubahn system, based on [this](https://raw.githubusercontent.com/skamsie/berlin-subway/master/U-Bahn_Berlin.png) official map from 2016. Clicking on the stations, brings up wiki info about it.


I created the map using a modified version of [d3-tube-map](https://github.com/johnwalley/d3-tube-map).

### Run locally

Even if the application only uses client side javascript, you still need to run a small web server to prevent *CORS* errors, because of loading *json* files from the local filesystem. A simple option would be Python's `SimpleHTTPServer` (or `http.server`, depending on the version of Python installed.). More about it [here](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/set_up_a_local_testing_server)

```bash
> cd berlin-ubahn-map
> python -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

![Screenshot of berlin-ubahn-map](/png/screenshot.png?raw=true "berlin-ubahn-map")
