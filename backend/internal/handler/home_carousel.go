package handler

import (
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterHomeCarouselRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/public/learning-square", func(c *gin.Context) {
		config, err := svc.PublicLearningSquareConfig()
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, gin.H{"learningSquare": config})
	})
	r.GET("/admin/linghua/learning-square", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		config, err := svc.AdminLearningSquareConfig(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"learningSquare": config})
	})
	r.PUT("/admin/linghua/learning-square", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request struct {
			LearningSquare service.LearningSquareConfig `json:"learningSquare"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		config, err := svc.UpdateAdminLearningSquareConfig(user, request.LearningSquare)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"learningSquare": config})
	})
	r.GET("/public/linghua/home-carousel", func(c *gin.Context) {
		config, err := svc.PublicHomeCarousel()
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
		ok(c, gin.H{"homeCarousel": config})
	})
	r.GET("/admin/linghua/home-carousel", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		config, err := svc.AdminHomeCarousel(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"homeCarousel": config})
	})
	r.PATCH("/admin/linghua/home-carousel", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request struct {
			HomeCarousel service.HomeCarouselConfig `json:"homeCarousel"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		config, err := svc.UpdateAdminHomeCarousel(user, request.HomeCarousel)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"homeCarousel": config})
	})
}
