<template>
  <div 
    ref="chartContainer"
    class="w-full"
    :style="{ minHeight: height }"
  ></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import ApexCharts from 'apexcharts';

export interface Props {
  data: {
    categories: string[];
    series: {
      name: string;
      data: number[];
    }[];
  };
  title?: string;
  height?: string;
  colors?: string[];
}
  
const props = withDefaults(defineProps<Props>(), {
  height: '400px',
  colors: () => ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
});

const chartContainer = ref<HTMLElement | null>(null);
let chart: ApexCharts | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
let themeObserver: MutationObserver | null = null;
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

function getIsDarkMode(): boolean {
  const dataTheme = document.documentElement.getAttribute('data-theme');
  // If data-theme is explicitly set, use it; otherwise check system preference
  if (dataTheme === 'dark' || dataTheme === 'light') {
    return dataTheme === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateChartTheme() {
  if (!chart) return;
  
  const newIsDarkMode = getIsDarkMode();
  
  // Neutral color palette matching the design system
  const colors = {
    light: {
      text: '#171717', // neutral-900
      border: '#e5e5e5', // neutral-200
      grid: '#e5e5e5' // neutral-200
    },
    dark: {
      text: '#fafafa', // neutral-50
      border: '#404040', // neutral-700
      grid: '#262626' // neutral-800
    }
  };
  
  const theme = newIsDarkMode ? colors.dark : colors.light;
  
  chart.updateOptions({
    xaxis: {
      labels: {
        style: {
          colors: theme.text,
          fontWeight: 700
        },
        formatter: function(val: string) {
          return val ? String(val).toUpperCase() : '';
        }
      },
      axisBorder: {
        color: theme.border
      },
      axisTicks: {
        color: theme.border
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: theme.text,
          fontWeight: 700
        },
        formatter: function(val: number) {
          // Format to at most one decimal place, removing trailing zeros
          const num = Number(val);
          if (isNaN(num)) return val;
          // Check if it's a whole number
          if (num % 1 === 0) {
            return num.toString();
          }
          // Round to one decimal place and remove trailing zeros
          return num.toFixed(1).replace(/\.0$/, '');
        }
      }
    },
    tooltip: {
      theme: newIsDarkMode ? 'dark' : 'light',
      background: newIsDarkMode ? '#171717' : '#ffffff',
      borderColor: theme.border
    },
    legend: {
      labels: {
        colors: theme.text
      }
    },
    grid: {
      borderColor: theme.grid,
      yaxis: {
        lines: {
          color: theme.grid
        }
      }
    }
  }, false, false, false);
}

function getChartOptions(isDarkMode: boolean) {
  const heightValue = parseInt(props.height.replace('px', '')) || 400;

  // Neutral color palette matching the design system
  const colors = {
    light: {
      background: '#ffffff', // white
      text: '#171717', // neutral-900
      textMuted: '#525252', // neutral-600
      border: '#e5e5e5', // neutral-200
      grid: '#e5e5e5' // neutral-200
    },
    dark: {
      background: '#171717', // neutral-900 (matches surface)
      text: '#fafafa', // neutral-50
      textMuted: '#a3a3a3', // neutral-400
      border: '#404040', // neutral-700
      grid: '#262626' // neutral-800
    }
  };

  const theme = isDarkMode ? colors.dark : colors.light;

  return {
    series: props.data.series,
    chart: {
      type: 'line',
      height: heightValue,
      background: 'transparent',
      toolbar: {
        show: false,
        offsetX: 0,
        offsetY: 0
      },
      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      zoom: {
        enabled: false
      },
      pan: {
        enabled: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 10
        },
        dynamicAnimation: {
          enabled: true,
          speed: 10
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 3,
      curve: 'smooth' as const,
      lineCap: 'round' as const,
      colors: props.colors
    },
    markers: {
      size: 5,
      strokeWidth: 2,
      strokeColors: props.colors,
      fillColors: props.colors,
      hover: {
        size: 7
      }
    },
    xaxis: {
      categories: props.data.categories,
      labels: {
        style: {
          colors: theme.text,
          fontSize: '12px',
          fontFamily: "'Rubik', sans-serif",
          fontWeight: 700
        },
        formatter: function(val: string) {
          return val ? String(val).toUpperCase() : '';
        }
      },
      axisBorder: {
        color: theme.border,
        show: false
      },
      axisTicks: {
        color: theme.border,
        show: false
      }
    },
    yaxis: {
      labels: {
        offsetX: 0,
        padding: 8,
        align: 'left',
        style: {
          colors: theme.text,
          fontSize: '12px',
          fontFamily: "'Rubik', sans-serif",
          fontWeight: 700
        },
        formatter: function(val: number) {
          // Format to at most one decimal place, removing trailing zeros
          const num = Number(val);
          if (isNaN(num)) return val;
          // Check if it's a whole number
          if (num % 1 === 0) {
            return num.toString();
          }
          // Round to one decimal place and remove trailing zeros
          return num.toFixed(1).replace(/\.0$/, '');
        }
      }
    },
    colors: props.colors,
    tooltip: {
      theme: isDarkMode ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: "'Rubik', sans-serif"
      },
      background: isDarkMode ? '#171717' : '#ffffff',
      borderColor: theme.border
    },
    legend: {
      position: 'bottom' as const,
      horizontalAlign: 'right' as const,
      labels: {
        colors: theme.text,
        useSeriesColors: false,
        formatter: function(seriesName: string) {
          return seriesName ? String(seriesName).toUpperCase() : '';
        }
      },
      markers: {
        width: 12,
        height: 12,
        offsetX: -4,
        customHTML: function() {
          return '<span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: currentColor;"></span>';
        }
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      },
    },
    grid: {
      borderColor: theme.grid,
      strokeDashArray: 4,
      padding: {
        left: 20,
        right: 8,
        top: 0,
        bottom: 0
      },
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true,
          color: theme.grid
        }
      }
    },
    responsive: [{
      breakpoint: 768,
      options: {
        chart: {
          height: 300
        },
        stroke: {
          width: 2
        },
        markers: {
          size: 4,
          strokeWidth: 2
        },
        legend: {
          position: 'bottom' as const,
          horizontalAlign: 'right' as const
        }
      }
    }]
  };
}

function initChart() {
  if (!chartContainer.value) return;

  try {
    // Validate data
    if (!props.data || !props.data.series || !props.data.categories) {
      console.error('Invalid chart data:', props.data);
      if (chartContainer.value) {
        chartContainer.value.innerHTML = '<p class="text-red-500 p-4">Invalid chart data provided.</p>';
      }
      return;
    }

    const isDarkMode = getIsDarkMode();
    const options = getChartOptions(isDarkMode);

    // Debug: Log options to verify configuration
    console.log('LineChart options:', JSON.stringify(options, null, 2));
    console.log('Series data:', props.data.series);
    console.log('Categories:', props.data.categories);

    chart = new ApexCharts(chartContainer.value, options);
    chart.render().then(() => {
      console.log('LineChart rendered successfully');
    }).catch((error: any) => {
      console.error('LineChart render error:', error);
    });

    // Handle window resize - hide chart during resize to prevent lag
    const handleResize = () => {
      if (!chartContainer.value) return;
      
      // Hide only the chart element during resize
      chartContainer.value.style.opacity = '0';
      chartContainer.value.style.transition = 'opacity 0.1s';
      
      // Clear previous timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Show chart after resize is complete (debounce)
      resizeTimeout = setTimeout(() => {
        if (chartContainer.value) {
          chartContainer.value.style.opacity = '1';
        }
        // Update chart size
        if (chart) {
          const heightValue = parseInt(props.height.replace('px', '')) || 400;
          chart.updateOptions({
            chart: {
              height: heightValue
            }
          });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    // Listen for theme changes via MutationObserver (for data-theme attribute)
    themeObserver = new MutationObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateChartTheme();
      });
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Also listen for system theme preference changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryListener = (e: MediaQueryListEvent) => {
      // Only update if no explicit theme is set
      const dataTheme = document.documentElement.getAttribute('data-theme');
      if (!dataTheme || dataTheme === 'auto') {
        requestAnimationFrame(() => {
          updateChartTheme();
        });
      }
    };
    darkModeMediaQuery.addEventListener('change', mediaQueryListener);

    // Store cleanup function
    const cleanup = () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (chart) {
        chart.destroy();
        chart = null;
      }
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
      if (mediaQueryListener) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.removeEventListener('change', mediaQueryListener);
        mediaQueryListener = null;
      }
    };

    // Store cleanup for onBeforeUnmount
    (chartContainer.value as any).__cleanup = cleanup;
  } catch (error: any) {
    console.error('Error loading chart:', error);
    if (chartContainer.value) {
      chartContainer.value.innerHTML = `<p class="text-red-500 p-4">Error loading chart: ${error.message || 'Unknown error'}. Check console for details.</p>`;
    }
  }
}

// Watch for data changes
watch(() => props.data, () => {
  if (chart && chartContainer.value) {
    const isDarkMode = getIsDarkMode();
    const options = getChartOptions(isDarkMode);
    chart.updateOptions(options);
  }
}, { deep: true });

onMounted(() => {
  initChart();
});

onBeforeUnmount(() => {
  if (chartContainer.value && (chartContainer.value as any).__cleanup) {
    (chartContainer.value as any).__cleanup();
  }
});
</script>

<style scoped>
.w-full {
  width: 100%;
}

/* Add padding between legend markers and labels */
:deep(.apexcharts-legend) {
  padding: 0;
}

:deep(.apexcharts-legend-series) {
  margin-right: 8px;
}

:deep(.apexcharts-legend-marker) {
  margin-right: 8px !important;
}

/* Make legend labels uppercase */
:deep(.apexcharts-legend-text) {
  text-transform: uppercase !important;
}

/* Style toolbar dropdown for dark/light mode */
:deep(.apexcharts-menu) {
  background: var(--color-background) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
}

:deep(.apexcharts-menu-item) {
  color: var(--color-text) !important;
  padding: 0.5rem 1rem !important;
}

:deep(.apexcharts-menu-item:hover) {
  background: var(--color-surface) !important;
}

</style>

