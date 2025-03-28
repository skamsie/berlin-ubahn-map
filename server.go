package main

import (
	"net/http"
	"os/exec"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Static("/", "public")

	e.GET("/find_route", func(c echo.Context) error {
		from := c.QueryParam("from")
		to := c.QueryParam("to")

		if from == "" || to == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Missing 'from' or 'to' query parameter",
			})
		}

		cmd := exec.Command("./route_finder", "--json", from, to)
		output, err := cmd.Output()
		if err != nil {
			return c.JSON(http.StatusUnprocessableEntity, map[string]string{
				"error": "could not find route",
			})
		}

		return c.Blob(http.StatusOK, "application/json", output)
	})

	e.Logger.Fatal(e.Start(":1323"))
}
