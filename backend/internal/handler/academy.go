package handler

import (
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterAcademyRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/public/linghua/academy", func(c *gin.Context) {
		config, err := svc.PublicAcademyConfig()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, config)
	})
	r.GET("/public/linghua/academy/:courseId", func(c *gin.Context) {
		course, categoryLabel, err := svc.PublicAcademyCourse(c.Param("courseId"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"course": course, "categoryLabel": categoryLabel})
	})
	r.GET("/admin/linghua/academy", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		config, err := svc.AdminAcademyConfig(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"config": config})
	})
	r.PATCH("/admin/linghua/academy", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512<<10)
		var config service.AcademyConfig
		if err := c.ShouldBindJSON(&config); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		saved, err := svc.UpdateAcademyConfig(actor, config)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"config": saved})
	})
}
