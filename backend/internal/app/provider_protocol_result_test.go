// 聚焦测试：finishProtocolResult 音频路径（非恢复）对多段输出的处理。
// 覆盖：普通 URL 下载全部到位、顺序不变；DataURL 内联路径同样保留所有音频；
// 单条兼容字段 "audio" 在非恢复路径中故意缺省，以防止 persistGeneratedMediaResultMode
// 的 JSON 深拷贝导致第一段音频被 storeResource 重复持久化。
//
// 另覆盖：protocolRequestFromInput 对 AudioInstrumental 的注入。

package app

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/protocol"
)

// TestProtocolRequestAudioInstrumentalInjection 验证 AudioInstrumental 在音频模式下
// 被正确注入到 request.ProviderOptions[interfaceType]["instrumental"]，
// 且值从字符串准确转换为布尔值；非音频模式和空值时不注入。
func TestProtocolRequestAudioInstrumentalInjection(t *testing.T) {
	for _, tc := range []struct {
		name          string
		mode          string
		interfaceType string
		instrumental  string
		wantPresent   bool
		wantValue     bool
	}{
		{name: "audio true", mode: "audio", interfaceType: "cangyuan-music-prompt", instrumental: "true", wantPresent: true, wantValue: true},
		{name: "audio false", mode: "audio", interfaceType: "cangyuan-music-prompt", instrumental: "false", wantPresent: true, wantValue: false},
		{name: "audio empty (omit)", mode: "audio", interfaceType: "cangyuan-music-prompt", instrumental: "", wantPresent: false},
		{name: "image mode skipped", mode: "image", interfaceType: "cangyuan-music-prompt", instrumental: "true", wantPresent: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := canvasGenerationInput{
				Mode: tc.mode,
				Config: providerConfig{
					InterfaceType:     tc.interfaceType,
					AudioInstrumental: tc.instrumental,
				},
			}
			req := protocolRequestFromInput(input)
			ns := req.ProviderOptions[tc.interfaceType]
			got, ok := ns["instrumental"]
			if ok != tc.wantPresent {
				t.Fatalf("instrumental present = %v, want %v (ProviderOptions = %#v)", ok, tc.wantPresent, req.ProviderOptions)
			}
			if tc.wantPresent && got != tc.wantValue {
				t.Fatalf("instrumental = %v, want %v", got, tc.wantValue)
			}
		})
	}
}

// audioTestInlineURL 返回一个最简 data URL，仅供协议结果解码路径测试，
// 不要求内容是合法音频（finishProtocolResult 不做音频签名校验）。
func audioTestInlineURL(mimeType, payload string) string {
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString([]byte(payload))
}

// TestFinishProtocolResultAudioURLsAllDownloadedInOrder 验证普通非恢复路径：
// 多个 URL 引用的音频全部下载，输出 "audios" 保留所有条目且顺序不变。
func TestFinishProtocolResultAudioURLsAllDownloadedInOrder(t *testing.T) {
	// 允许访问 httptest 服务器（127.0.0.1），与 task_media_recovery_test.go 一致。
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")

	tracks := []struct {
		path     string
		mimeType string
	}{
		{"/track1.mp3", "audio/mpeg"},
		{"/track2.mp3", "audio/mpeg"},
	}
	downloadCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, tr := range tracks {
			if r.URL.Path == tr.path {
				w.Header().Set("Content-Type", tr.mimeType)
				_, _ = w.Write([]byte("bytes-" + tr.path))
				downloadCount++
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	result := &protocol.Result{
		Audios: []protocol.MediaReference{
			{URL: server.URL + tracks[0].path},
			{URL: server.URL + tracks[1].path},
		},
	}

	output, err := finishProtocolResult(
		context.Background(),
		providerConfig{BaseURL: server.URL},
		"audio", "", result, defaultVideoPollPolicy(),
	)
	if err != nil {
		t.Fatalf("finishProtocolResult error: %v", err)
	}

	// 两个 URL 均已下载。
	if downloadCount != 2 {
		t.Errorf("downloadCount = %d, want 2", downloadCount)
	}

	// 模式字段正确。
	if output["mode"] != "audio" {
		t.Fatalf("mode = %v, want audio", output["mode"])
	}

	// "audios" 数组包含全部音频。
	audios, ok := output["audios"].([]interface{})
	if !ok {
		t.Fatalf("output[\"audios\"] is %T, want []interface{}", output["audios"])
	}
	if len(audios) != 2 {
		t.Fatalf("len(audios) = %d, want 2", len(audios))
	}

	// 顺序不变：每个元素带有 mimeType 和 dataUrl。
	for i, item := range audios {
		m, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("audios[%d] is %T, want map[string]interface{}", i, item)
		}
		if m["mimeType"] != tracks[i].mimeType {
			t.Errorf("audios[%d].mimeType = %v, want %v", i, m["mimeType"], tracks[i].mimeType)
		}
		if _, hasDataURL := m["dataUrl"]; !hasDataURL {
			t.Errorf("audios[%d] missing dataUrl", i)
		}
	}

	// 兼容字段 "audio" 故意缺省：非恢复路径若同时设置 "audio" 与 "audios"，
	// persistGeneratedMediaResultMode 的 JSON 深拷贝会让第一段音频被 storeResource
	// 重复调用并多扣用户配额；恢复路径（task_media_recovery.go materializeTaskMedia）
	// 在所有 items 已为资源 URL 后才同时设置两者，inlineMediaValue 不再触发，不受此限。
	if _, hasAudio := output["audio"]; hasAudio {
		t.Fatal("non-recovery path must not set output[\"audio\"] to prevent double storeResource on first item")
	}
}

// TestFinishProtocolResultAudioDataURLsAllRetainedInOrder 验证 DataURL 内联路径：
// 多个 DataURL 音频全部出现在 "audios" 中且顺序不变；mimeType 与声明一致。
func TestFinishProtocolResultAudioDataURLsAllRetainedInOrder(t *testing.T) {
	mimeTypes := []string{"audio/mpeg", "audio/wav"}
	result := &protocol.Result{
		Audios: []protocol.MediaReference{
			{DataURL: audioTestInlineURL(mimeTypes[0], "data-track-0"), MIMEType: mimeTypes[0]},
			{DataURL: audioTestInlineURL(mimeTypes[1], "data-track-1"), MIMEType: mimeTypes[1]},
		},
	}

	output, err := finishProtocolResult(
		context.Background(),
		providerConfig{},
		"audio", "", result, defaultVideoPollPolicy(),
	)
	if err != nil {
		t.Fatalf("finishProtocolResult error: %v", err)
	}

	audios, ok := output["audios"].([]interface{})
	if !ok || len(audios) != 2 {
		t.Fatalf("output[\"audios\"] = %v (len %d), want []interface{} len 2", output["audios"], len(audios))
	}

	for i, item := range audios {
		m, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("audios[%d] is %T, want map", i, item)
		}
		if m["mimeType"] != mimeTypes[i] {
			t.Errorf("audios[%d].mimeType = %v, want %v", i, m["mimeType"], mimeTypes[i])
		}
		if _, hasDataURL := m["dataUrl"]; !hasDataURL {
			t.Errorf("audios[%d] missing dataUrl", i)
		}
	}

	// 兼容字段缺省，与 URL 路径一致。
	if _, hasAudio := output["audio"]; hasAudio {
		t.Fatal("output must not contain \"audio\" key in non-recovery path")
	}
}
