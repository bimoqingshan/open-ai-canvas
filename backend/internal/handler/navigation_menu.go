package handler

import (
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterNavigationMenuRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/public/linghua/navigation-menu", func(c *gin.Context) {
		items, err := svc.PublicNavigationMenu()
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, gin.H{"items": items})
	})
	r.GET("/admin/linghua/navigation-menu", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		items, err := svc.AdminNavigationMenu(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"items": items})
	})
	r.PUT("/admin/linghua/navigation-menu", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request struct {
			Items []service.NavigationMenuItemInput `json:"items"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		items, err := svc.SaveAdminNavigationMenu(user, request.Items)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"items": items})
	})
	r.PUT("/admin/linghua/navigation-menu/:id", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request service.NavigationMenuItemInput
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		request.ID = c.Param("id")
		item, err := svc.SaveAdminNavigationMenuItem(user, request)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"item": item})
	})
	r.POST("/admin/linghua/navigation-menu", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request service.NavigationMenuItemInput
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		item, err := svc.SaveAdminNavigationMenuItem(user, request)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"item": item})
	})
	r.DELETE("/admin/linghua/navigation-menu/:id", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.DeleteAdminNavigationMenuItem(user, c.Param("id")); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"deleted": true})
	})
}
