#!/bin/bash
curl --get 'http://localhost:1323/find_route' \
     --data-urlencode 'from=Schönhauser Allee' \
     --data-urlencode 'to=Magdalenenstraße'
