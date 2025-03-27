package main

import (
	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()

	// Serve static files from "public" directory
	e.Static("/", "public")

	// Optional: fallback route for SPA-style routing
	e.File("/", "public/index.html")

	e.Logger.Fatal(e.Start(":1323"))
}
