package handler

import (
	"net/http"
	"strings"
	"time"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterCommunityRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/public/linghua/community/works", func(c *gin.Context) {
		if !enforceRateLimit(c, "public-community:"+c.ClientIP(), 120, time.Minute) {
			return
		}
		limit, err := parsePositiveQueryInt(c.Query("pageSize"), 24)
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		page, err := svc.PublicCommunityWorksPage(c.Query("keyword"), c.Query("challengeId"), c.Query("categoryId"), c.Query("cursor"), limit)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
		ok(c, page)
	})

	r.GET("/public/linghua/community/categories", func(c *gin.Context) {
		categories, err := svc.PublicCommunityCategories()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"categories": categories})
	})

	r.GET("/public/linghua/community/works/:id", func(c *gin.Context) {
		work, err := svc.PublicCommunityWork(c.Param("id"))
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
		ok(c, gin.H{"work": work})
	})

	r.GET("/public/linghua/community/works/:id/creator-avatar", func(c *gin.Context) {
		if !enforceRateLimit(c, "public-community-avatar:"+c.ClientIP(), 300, time.Minute) {
			return
		}
		data, err := svc.PublicCommunityCreatorAvatar(c.Param("id"))
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=120")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Data(http.StatusOK, "image/png", data)
	})

	r.GET("/public/linghua/community/works/:id/media/:kind", func(c *gin.Context) {
		if !enforceRateLimit(c, "public-community-media:"+c.ClientIP(), 300, time.Minute) {
			return
		}
		delivery, err := svc.PreparePublicCommunityMedia(c.Param("id"), c.Param("kind"), c.GetHeader("Range"), resourceAccessOptions(c))
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("X-Robots-Tag", "noindex, nofollow")
		serveResourceDelivery(c, delivery, "public, max-age=300", "")
	})

	r.GET("/admin/linghua/community/works/:id/media/:kind", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		delivery, err := svc.PrepareAdminCommunityMedia(user, c.Param("id"), c.Param("kind"), c.GetHeader("Range"), resourceAccessOptions(c))
		if err != nil {
			failService(c, err)
			return
		}
		serveResourceDelivery(c, delivery, "private, no-store", "")
	})

	r.GET("/public/linghua/community/challenges", func(c *gin.Context) {
		challenges, err := svc.CreatorChallengeList()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"challenges": challenges})
	})

	r.GET("/linghua/community/work-options", func(c *gin.Context) {
		if _, err := currentUser(c, svc); err != nil {
			failService(c, err)
			return
		}
		challenges, err := svc.CommunityWorkOptions()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"challenges": challenges})
	})

	r.GET("/linghua/community/my-works", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		works, err := svc.MyCommunityWorks(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"works": works})
	})

	r.POST("/linghua/community/works", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if !enforceRateLimit(c, "community-submit:"+user.ID, 10, time.Hour) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32<<10)
		var req service.CommunityWorkSubmission
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		work, err := svc.SubmitCommunityWork(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"work": work})
	})

	r.GET("/admin/linghua/community/works", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		page, pageSize, err := parsePaginationQuery(c, 20)
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.AdminCommunityWorkPage(user, strings.TrimSpace(c.Query("status")), strings.TrimSpace(c.Query("categoryId")), strings.TrimSpace(c.Query("keyword")), page, pageSize)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	r.PATCH("/admin/linghua/community/works/:id/review", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
		var req service.CommunityWorkReviewRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		work, err := svc.ReviewCommunityWork(user, c.Param("id"), req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"work": work})
	})

	r.GET("/admin/linghua/community/categories", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		categories, err := svc.AdminCommunityCategories(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"categories": categories})
	})

	r.POST("/admin/linghua/community/categories", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
		var req service.CommunityCategoryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		category, err := svc.SaveCommunityCategory(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"category": category})
	})

	r.PATCH("/admin/linghua/community/works/category", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32<<10)
		var req service.CommunityWorkCategoryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		if err := svc.AssignCommunityWorksCategory(user, req); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"workIds": req.WorkIDs, "categoryId": req.CategoryID})
	})

	r.PATCH("/admin/linghua/community/works/reorder", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32<<10)
		var req service.CommunityWorkReorderRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		moved, err := svc.MoveCommunityWork(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"workId": req.WorkID, "categoryId": req.CategoryID, "moved": moved})
	})

	r.GET("/admin/linghua/community/challenges", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		challenges, err := svc.AdminCreatorChallengeList(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"challenges": challenges})
	})

	r.POST("/admin/linghua/community/challenges", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
		var req service.CreatorChallengeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		challenge, err := svc.SaveCreatorChallenge(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"challenge": challenge})
	})
}
