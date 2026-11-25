package protocol

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// Exercise both the editable manifest and the installed archive with the real adapter.
func seedanceAudioAdapters(t *testing.T, check func(*testing.T, Adapter)) {
	t.Helper()
	t.Run("manifest", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join("..", "..", "..", "plugin-packages", "seedance-audio", "manifest.json"))
		if err != nil {
			t.Fatal(err)
		}
		adapter, err := LoadManifest(data)
		if err != nil {
			t.Fatal(err)
		}
		check(t, adapter)
	})
	t.Run("package", func(t *testing.T) {
		check(t, officialPackageAdapter(t, "seedance-audio.yingce-plugin", "seedance-audio"))
	})
}

func seedanceAudioRequest() GenerationRequest {
	return GenerationRequest{Capability: CapabilityAudio, Model: "doubao-seed-audio-1.0", Prompt: "请用自然的声音朗读这段文字"}
}

func TestSeedanceAudioPackageContract(t *testing.T) {
	root := filepath.Join("..", "..", "..", "plugin-packages")
	archive, err := os.ReadFile(filepath.Join(root, "seedance-audio.yingce-plugin"))
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := ParsePluginPackage(archive)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"manifest.json", "README.md", "docs/interface.md"} {
		want, err := os.ReadFile(filepath.Join(root, "seedance-audio", name))
		if err != nil || !bytes.Equal(pkg.Files[name], want) {
			t.Fatalf("package %s differs from source, err=%v", name, err)
		}
	}
	provider := pkg.Manifest.Contributes.Providers[0]
	if pkg.Manifest.Metadata.ID != "seedance-audio" || provider.BaseURL != "https://api.seedance.nz" || !provider.RequiresPublicMediaURLs || provider.Auth.Type != "bearer" || provider.Auth.Field != "apiKey" {
		t.Fatalf("identity, public media or bearer contract = %#v", provider)
	}
	if pkg.Manifest.Runtime.Backend != "" && pkg.Manifest.Runtime.Backend != "declarative" {
		t.Fatalf("plugin requires a runtime: %#v", pkg.Manifest.Runtime)
	}
}

func TestSeedanceAudioBuildRequestDefaults(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, extra := range []map[string]any{nil, {"audioSpeed": "", "audioFormat": "", "audioVoice": "alloy"}} {
			r := seedanceAudioRequest()
			r.Extra = extra
			spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: r})
			if err != nil {
				t.Fatal(err)
			}
			if spec.Method != "POST" || spec.Path != "/v1/audio/generations" || spec.ContentType != "application/json" || spec.Auth.Type != "bearer" || spec.Auth.Field != "apiKey" {
				t.Fatalf("request = %#v", spec)
			}
			want := map[string]any{"model": r.Model, "prompt": r.Prompt, "metadata": map[string]any{"format": "wav", "sample_rate": "24000", "speech_rate": float64(0)}}
			if got := manifestTestBody(t, spec); !reflect.DeepEqual(got, want) {
				t.Errorf("defaults = %#v, want %#v", got, want)
			}
		}
	})
}

func TestSeedanceAudioBuildRequestSpeedAndOptions(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, test := range []struct {
			speed any
			want  float64
		}{{"0.25", -50}, {0.5, -50}, {"0.85", -15}, {1, 0}, {"1.15", 15}, {"1.5", 50}, {2, 100}, {"4", 100}} {
			r := seedanceAudioRequest()
			r.Extra = map[string]any{"audioSpeed": test.speed}
			spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: r})
			if err != nil {
				t.Fatal(err)
			}
			if got := manifestTestBody(t, spec)["metadata"].(map[string]any)["speech_rate"]; got != test.want {
				t.Errorf("speed %v = %v, want %v", test.speed, got, test.want)
			}
		}
		for _, format := range []string{"wav", "mp3", "pcm", "ogg_opus"} {
			for _, rate := range []string{"8000", "16000", "24000", "32000", "44100"} {
				r := seedanceAudioRequest()
				r.Extra = map[string]any{"audioFormat": format, "audioVoice": "speaker-1", "audioSpeed": "2"}
				r.ProviderOptions = map[string]map[string]any{"seedance-audio": {"sample_rate": rate, "speech_rate": 0, "loudness_rate": 0, "pitch_rate": -12}}
				spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: r})
				if err != nil {
					t.Fatal(err)
				}
				want := map[string]any{"format": format, "speaker": "speaker-1", "sample_rate": rate, "speech_rate": float64(0), "loudness_rate": float64(0), "pitch_rate": float64(-12)}
				if got := manifestTestBody(t, spec)["metadata"]; !reflect.DeepEqual(got, want) {
					t.Errorf("metadata = %#v, want %#v", got, want)
				}
			}
		}
	})
}

func TestSeedanceAudioBuildRequestReferences(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, mode := range []string{"images", "audios"} {
			t.Run(mode, func(t *testing.T) {
				r := seedanceAudioRequest()
				r.Extra = map[string]any{"audioVoice": "alloy"}
				if mode == "images" {
					r.Images = []MediaReference{{URL: "https://media.example/first.png"}, {URL: "https://media.example/ignored.png"}}
				} else {
					r.Audios = []MediaReference{{URL: "https://media.example/a.mp3", MIMEType: "audio/mpeg"}, {URL: "https://media.example/b.wav", MIMEType: "audio/wav"}, {URL: "https://media.example/c.wav"}}
				}
				spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: r})
				if err != nil {
					t.Fatal(err)
				}
				body := manifestTestBody(t, spec)
				if mode == "images" && !reflect.DeepEqual(body["images"], []any{"https://media.example/first.png"}) {
					t.Errorf("images = %#v", body["images"])
				}
				metadata := body["metadata"].(map[string]any)
				if mode == "audios" && !reflect.DeepEqual(metadata["audio_url"], []any{"https://media.example/a.mp3", "https://media.example/b.wav", "https://media.example/c.wav"}) {
					t.Errorf("audio_url = %#v", metadata["audio_url"])
				}
				if _, ok := metadata["speaker"]; ok {
					t.Fatal("unexpected speaker")
				}
			})
		}
	})
}

func TestSeedanceAudioBuildRequestValidation(t *testing.T) {
	type validationCase struct {
		name   string
		mutate func(*GenerationRequest)
		valid  bool
	}
	tests := []validationCase{
		{"min unicode prompt", func(r *GenerationRequest) { r.Prompt = strings.Repeat("字", 5) }, true},
		{"max unicode prompt", func(r *GenerationRequest) { r.Prompt = strings.Repeat("字", 2048) }, true},
		{"short prompt", func(r *GenerationRequest) { r.Prompt = "四个汉字" }, false},
		{"long prompt", func(r *GenerationRequest) { r.Prompt = strings.Repeat("字", 2049) }, false},
		{"blank prompt", func(r *GenerationRequest) { r.Prompt = "     " }, false},
		{"unknown model", func(r *GenerationRequest) { r.Model = "mureka" }, false},
		{"empty model", func(r *GenerationRequest) { r.Model = "" }, false},
		{"speaker with image", func(r *GenerationRequest) {
			r.Extra["audioVoice"] = "voice"
			r.Images = []MediaReference{{URL: "https://media.example/a.png"}}
		}, false},
		{"speaker with audio", func(r *GenerationRequest) {
			r.Extra["audioVoice"] = "voice"
			r.Audios = []MediaReference{{URL: "https://media.example/a.mp3"}}
		}, false},
		{"image with audio", func(r *GenerationRequest) {
			r.Images = []MediaReference{{URL: "https://media.example/a.png"}}
			r.Audios = []MediaReference{{URL: "https://media.example/a.mp3"}}
		}, false},
		{"four audios", func(r *GenerationRequest) {
			for i := 0; i < 4; i++ {
				r.Audios = append(r.Audios, MediaReference{URL: "https://media.example/a.mp3"})
			}
		}, false},
		{"data image", func(r *GenerationRequest) { r.Images = []MediaReference{{DataURL: "data:image/png;base64,aA=="}} }, false},
		{"data audio", func(r *GenerationRequest) { r.Audios = []MediaReference{{DataURL: "data:audio/wav;base64,aA=="}} }, false},
		{"file audio", func(r *GenerationRequest) { r.Audios = []MediaReference{{URL: "file:///tmp/a.wav"}} }, false},
		{"unsupported audio MIME", func(r *GenerationRequest) {
			r.Audios = []MediaReference{{URL: "https://media.example/a.ogg", MIMEType: "audio/ogg"}}
		}, false},
		{"video input", func(r *GenerationRequest) { r.Videos = []MediaReference{{URL: "https://media.example/a.mp4"}} }, false},
		{"bad format", func(r *GenerationRequest) { r.Extra["audioFormat"] = "aac" }, false},
		{"invalid speed", func(r *GenerationRequest) { r.Extra["audioSpeed"] = "fast" }, false},
		{"zero speed", func(r *GenerationRequest) { r.Extra["audioSpeed"] = "0" }, false},
		{"negative speed", func(r *GenerationRequest) { r.Extra["audioSpeed"] = "-1" }, false},
		{"NaN speed", func(r *GenerationRequest) { r.Extra["audioSpeed"] = "NaN" }, false},
	}
	for _, key := range []string{"speech_rate", "loudness_rate", "pitch_rate"} {
		min, max := -50, 100
		if key == "pitch_rate" {
			min, max = -12, 12
		}
		for _, value := range []any{min, max, 0, min - 1, max + 1, 1.5, "bad", true} {
			valid := value == min || value == max || value == 0
			tests = append(tests, validationCase{key + "/" + manifestString(value), func(r *GenerationRequest) { r.ProviderOptions["seedance-audio"][key] = value }, valid})
		}
	}
	for _, value := range []any{"22050", true, 24000} {
		tests = append(tests, validationCase{"sample_rate/" + manifestString(value), func(r *GenerationRequest) { r.ProviderOptions["seedance-audio"]["sample_rate"] = value }, value == 24000})
	}
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				r := seedanceAudioRequest()
				r.Extra = map[string]any{}
				r.ProviderOptions = map[string]map[string]any{"seedance-audio": {}}
				test.mutate(&r)
				_, err := adapter.BuildCreate(context.Background(), RequestContext{Request: r})
				if (err == nil) != test.valid {
					t.Fatalf("error=%v, valid=%v", err, test.valid)
				}
			})
		}
	})
}

func TestSeedanceAudioLifecycle(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		created, err := adapter.ParseCreate(context.Background(), []byte(`{"id":"record-1","task_id":"task-1","status":"queued"}`))
		if err != nil || created.TaskID != "task-1" || created.Status != StatusPending {
			t.Fatalf("create=%#v err=%v", created, err)
		}
		poll, err := adapter.BuildPoll(context.Background(), PollContext{TaskID: "task-1"})
		if err != nil || poll.Method != "GET" || poll.Path != "/v1/audio/generations/task-1" || poll.Auth.Type != "bearer" || poll.Auth.Field != "apiKey" {
			t.Fatalf("poll=%#v err=%v", poll, err)
		}
		for _, test := range []struct {
			status string
			want   Status
		}{{"NOT_START", StatusPending}, {"SUBMITTED", StatusPending}, {"IN_PROGRESS", StatusProcessing}, {"SUCCESS", StatusSucceeded}, {"FAILURE", StatusFailed}} {
			t.Run(test.status, func(t *testing.T) {
				task := map[string]any{"task_id": "task-1", "status": test.status}
				if test.status == "SUCCESS" {
					task["data"] = map[string]any{"status": "succeeded", "content": map[string]any{"audio_url": "https://media.example/a.wav"}}
				}
				if test.status == "FAILURE" {
					task["fail_reason"] = "generation rejected"
				}
				body, _ := json.Marshal(map[string]any{"code": "success", "data": task})
				state, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "task-1"}, body)
				if err != nil || state.TaskID != "task-1" || state.Status != test.want {
					t.Fatalf("state=%#v err=%v", state, err)
				}
				if test.want == StatusFailed && state.Message != "generation rejected" {
					t.Fatalf("message=%q", state.Message)
				}
			})
		}
	})
}

func TestSeedanceAudioUpstreamErrorsTerminate(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, body := range []string{
			`{"code":"error","message":"quota exhausted"}`,
			`{"code":401,"msg":"unauthorized"}`,
			`{"code":0,"message":"unexpected code"}`,
			`{"error":{"message":"invalid API key"}}`,
			`{"error":"service unavailable"}`,
			`{"code":"success","data":{"status":"IN_PROGRESS","error":{"message":"provider stopped"}}}`,
			`{"code":"success","data":{"status":"FAILURE","fail_reason":"blocked"}}`,
			`{"code":"success","data":{"status":"SUCCESS","data":{"status":"failed","error":{"message":"nested failure"}}}}`,
			`{"code":"failed","message":"denied","data":{"status":"SUCCESS","result_url":"https://media.example/stale.wav"}}`,
			`{"code":"success","data":{"status":"SUCCESS"}}`,
			`{"code":"success","data":{"status":"unexpected-state"}}`,
			`{}`,
		} {
			created, err := adapter.ParseCreate(context.Background(), []byte(body))
			if err != nil || created.Status != StatusFailed || created.Message == "" {
				t.Errorf("create %s => %#v err=%v", body, created, err)
			}
			state, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "task-1"}, []byte(body))
			if err != nil || state.Status != StatusFailed || state.Message == "" {
				t.Errorf("poll %s => %#v err=%v", body, state, err)
			}
		}
		for _, body := range []string{`not json`, `{"status":`} {
			if _, err := adapter.ParseCreate(context.Background(), []byte(body)); err == nil {
				t.Error("invalid create JSON accepted")
			}
			if _, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "task-1"}, []byte(body)); err == nil {
				t.Error("invalid poll JSON accepted")
			}
		}
	})
}

func TestSeedanceAudioOrderedResults(t *testing.T) {
	seedanceAudioAdapters(t, func(t *testing.T, adapter Adapter) {
		for _, test := range []struct {
			name, body string
			urls       []string
		}{
			{"nested list wins", `{"code":"success","data":{"status":"SUCCESS","result_url":"https://media.example/short.wav","data":{"status":"succeeded","content":{"audio_urls":["https://media.example/b.wav","https://media.example/a.wav"],"audio_url":"https://media.example/first.wav"}}}}`, []string{"https://media.example/b.wav", "https://media.example/a.wav"}},
			{"direct content list wins", `{"code":"success","data":{"status":"SUCCESS","result_url":"https://media.example/short.wav","content":{"audio_urls":["https://media.example/b.wav","https://media.example/a.wav"]}}}`, []string{"https://media.example/b.wav", "https://media.example/a.wav"}},
			{"nested single", `{"code":"success","data":{"data":{"status":"succeeded","content":{"audio_url":"https://media.example/a.wav"}}}}`, []string{"https://media.example/a.wav"}},
			{"result URL fallback", `{"code":"success","data":{"status":"SUCCESS","result_url":"https://media.example/a.wav","data":{"content":{"audio_urls":[]}}}}`, []string{"https://media.example/a.wav"}},
		} {
			t.Run(test.name, func(t *testing.T) {
				state, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "task-1"}, []byte(test.body))
				if err != nil || state.Status != StatusSucceeded || state.Result == nil {
					t.Fatalf("state=%#v err=%v", state, err)
				}
				var urls []string
				for _, audio := range state.Result.Audios {
					urls = append(urls, audio.URL)
					if audio.Kind != "audio" || !audio.Ephemeral {
						t.Errorf("audio=%#v", audio)
					}
				}
				if !reflect.DeepEqual(urls, test.urls) {
					t.Errorf("urls=%v want=%v", urls, test.urls)
				}
			})
		}
	})
}
