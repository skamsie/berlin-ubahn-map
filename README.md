# berlin-ubahn-map

https://ubahn-map.com/

An interactive way of displaying the Berlin Ubahn system, based on [this](https://raw.githubusercontent.com/skamsie/berlin-subway/master/U-Bahn_Berlin.png) official map from 2016.

- clicking on the stations brings up wiki info about it and a photo taken at the respective station
- there is also a route finder (from A to B) based on a small Prolog alghoritm

### Run locally

Assuming `go` and `swipl` are installed:

```shell
# build the binaries for the route finder and the server
make all

# run the server on the default port (1323)
./ubahn-map-server
```

### About

- I created the map using a modified version of [d3-tube-map](https://github.com/johnwalley/d3-tube-map)
- the server is a small go application running on [echo](https://echo.labstack.com/)
- the route finder alghoritm is a Prolog program from a separate repository: [skamsie/berlin-subway](https://github.com/skamsie/berlin-subway)

![Screenshot of berlin-ubahn-map](public/png/screenshot.png?raw=true "berlin-ubahn-map")
