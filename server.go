package main

import (
	"crypto/sha1"
	"fmt"
	"net/http"
	"os"
	"os/exec"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	// Global middleware for logging, recovery, and security.
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.Secure())

	// Serve static files from the "public" directory.
	e.Static("/", "public")

	// main page
	e.GET("/", func(c echo.Context) error {
		return c.File("public/index.html")
	})

	// Get environment variables.
	routeFinderPath := os.Getenv("ROUTE_FINDER_PATH")
	port := os.Getenv("PORT")
	if port == "" {
		port = "1323"
	}
	if routeFinderPath == "" {
		routeFinderPath = "./route_finder"
	}

	apiGroup := e.Group("/api")

	// Apply the rate limiter middleware only for routes in the api group.
	apiGroup.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20)))

	// /api/find_route
	apiGroup.GET("/find_route", func(c echo.Context) error {
		from := c.QueryParam("from")
		to := c.QueryParam("to")

		if from == "" || to == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Missing 'from' or 'to' query parameter",
			})
		}

		// Execute the external command.
		cmd := exec.Command(routeFinderPath, "--json", from, to)
		output, err := cmd.Output()
		if err != nil {
			e.Logger.Error("route_finder error: ", err)
			return c.JSON(http.StatusUnprocessableEntity, map[string]string{
				"error": "could not find route",
			})
		}

		// Generate ETag based on the output.
		hash := sha1.Sum(output)
		etag := fmt.Sprintf("%x", hash)
		c.Response().Header().Set("ETag", etag)

		// Add a Cache-Control header to instruct the client to cache the response for 30 seconds.
		c.Response().Header().Set("Cache-Control", "public, max-age=30")

		// Check for a matching If-None-Match header.
		if match := c.Request().Header.Get("If-None-Match"); match != "" && match == etag {
			return c.NoContent(http.StatusNotModified)
		}

		// Return the output with the proper JSON content type.
		return c.Blob(http.StatusOK, "application/json", output)
	})

	// Start the server.
	e.Logger.Fatal(e.Start(":" + port))
}
