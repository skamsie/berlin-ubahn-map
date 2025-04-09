package main

import (
	"net/http"
	"os"
	"os/exec"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.Secure())
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20)))

	// Serve static files from "public" directory
	e.Static("/", "public")

	// Get environment variables
	routeFinderPath := os.Getenv("ROUTE_FINDER_PATH")
	port := os.Getenv("PORT")

	if port == "" {
		port = "1323"
	}
	if routeFinderPath == "" {
		routeFinderPath = "./route_finder"
	}

	// Route handler
	e.GET("/find_route", func(c echo.Context) error {
		from := c.QueryParam("from")
		to := c.QueryParam("to")

		if from == "" || to == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Missing 'from' or 'to' query parameter",
			})
		}

		cmd := exec.Command(routeFinderPath, "--json", from, to)
		output, err := cmd.Output()
		if err != nil {
			e.Logger.Error("route_finder error: ", err)
			return c.JSON(http.StatusUnprocessableEntity, map[string]string{
				"error": "could not find route",
			})
		}

		return c.Blob(http.StatusOK, "application/json", output)
	})

	e.Logger.Fatal(e.Start(":" + port))
}
