{{/*
Return a fully qualified image name for a given service.
Usage: {{ include "nexus-hr.image" (dict "service" "auth-service" "root" .) }}
*/}}
{{- define "nexus-hr.image" -}}
{{- printf "%s-%s:%s" .root.Values.image.registry .service .root.Values.image.tag -}}
{{- end -}}

{{/*
Common labels applied to every resource.
*/}}
{{- define "nexus-hr.labels" -}}
app.kubernetes.io/part-of: nexus-hr-system
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/*
Selector labels for a given component.
*/}}
{{- define "nexus-hr.selectorLabels" -}}
app: {{ . }}
{{- end -}}
