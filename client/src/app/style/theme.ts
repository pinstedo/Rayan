export const theme = {
	colors: {
		primary: "#0ea5e9", // Tailwind light blue (sky-500)
		primaryHover: "#0284c7", // Sky-600
		secondary: "#64748b", // Slate-500
		success: "#10b981", // Emerald-500
		error: "#ef4444", // Red-500
		warning: "#f59e0b", // Amber-500
		
		background: "#f8fafc", // Slate-50
		surface: "#ffffff", // White cards
		
		textPrimary: "#0f172a", // Slate-900
		textSecondary: "#64748b", // Slate-500
		textMuted: "#94a3b8", // Slate-400
		
		border: "#e2e8f0", // Slate-200
	},
	spacing: {
		xs: 4,
		sm: 8,
		md: 16,
		lg: 24,
		xl: 32,
		xxl: 48,
	},
	borderRadius: {
		sm: 4,
		md: 8,
		lg: 12,
		xl: 16,
		full: 9999,
	},
	typography: {
		fonts: {
			regular: "System",
			bold: "System",
		},
		sizes: {
			xs: 12,
			sm: 14,
			md: 16,
			lg: 18,
			xl: 24,
			xxl: 32,
		},
	},
	shadows: {
		sm: {
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.05,
			shadowRadius: 2,
			elevation: 1,
		},
		md: {
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 4,
			elevation: 3,
		},
		lg: {
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.1,
			shadowRadius: 12,
			elevation: 6,
		},
	},
};
