import React, { useState } from 'react';
import { Box, Tabs, Tab, Grid, useMediaQuery, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useMetalPriceHistory } from '../hooks/useMetalPriceHistory';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type PeriodKey = '1ヶ月' | '3ヶ月' | '6ヶ月' | '1年';

const PERIODS: Record<PeriodKey, number> = {
  '1ヶ月': 30,
  '3ヶ月': 90,
  '6ヶ月': 180,
  '1年': 365
};

interface PriceHistory {
  date: string;
  au_retail_price: string;
  pt_retail_price: string;
  pd_retail_price: string;
  ag_retail_price: string;
}

type LineChartProps = {
  labels: string[];
  menuName: string;
  data: number[];
  color: string;
  period: PeriodKey;
};

// 日付を「年/月/日」または「月/日」形式にフォーマットする関数
const formatDate = (dateString: string, showYear: boolean = true): string => {
  // YYYY-MM-DD形式の日付を想定
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString; // フォーマットが異なる場合はそのまま返す
  
  if (showYear) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`; // 年/月/日
  } else {
    // 月初めの場合は「M月」形式で表示
    if (parts[2] === '01' || parts[2] === '1') {
      return `${parseInt(parts[1])}月`;
    }
    // それ以外は「M/D」形式
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`; // 先頭の0を省略
  }
};

const LineChart: React.FC<LineChartProps> = ({ labels, menuName, data, color, period }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // X軸のラベル表示を間引く処理
  const getTicksCallback = () => {
    return function(value: string | number, index: number, ticks: any[]) {
      const total = ticks.length;
      
      // 最初と最後は必ず表示
      if (index === 0 || index === total - 1) {
        if (labels[index]) {
          return formatDate(labels[index], false);
        }
        return '';
      }
      
      // 期間に基づいて表示するポイントを選択
      switch(period) {
        case '1ヶ月':
          // 1ヶ月の場合は月初めと約10日ごとに表示
          if (labels[index]) {
            const parts = labels[index].split('-');
            // 月初めまたは10日ごとに表示
            if (parts[2] === '01' || parts[2] === '10' || parts[2] === '20') {
              // 最初と最後の近くは表示しない
              if (index > 3 && index < total - 3) {
                return formatDate(labels[index], false);
              }
            }
          }
          break;
          
        case '3ヶ月':
          // 3ヶ月の場合は月初めのみ表示
          if (labels[index]) {
            const parts = labels[index].split('-');
            if (parts[2] === '01') {
              // 最初と最後の近くは表示しない
              if (index > 5 && index < total - 5) {
                return formatDate(labels[index], false);
              }
            }
          }
          break;
          
        case '6ヶ月':
          // 6ヶ月の場合は月初めを間引いて表示
          if (labels[index]) {
            const parts = labels[index].split('-');
            if (parts[2] === '01') {
              // 偶数月のみ表示
              const month = parseInt(parts[1]);
              if (month % 2 === 0) {
                // 最初と最後の近くは表示しない
                if (index > 10 && index < total - 10) {
                  return formatDate(labels[index], false);
                }
              }
            }
          }
          break;
          
        case '1年':
          // 1年の場合は四半期ごとに表示
          if (labels[index]) {
            const parts = labels[index].split('-');
            if (parts[2] === '01') {
              const month = parseInt(parts[1]);
              if (month === 1 || month === 4 || month === 7 || month === 10) {
                // 最初と最後の近くは表示しない
                if (index > 15 && index < total - 15) {
                  return formatDate(labels[index], false);
                }
              }
            }
          }
          break;
      }
      
      return '';
    };
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 5,
        right: 15, // さらに右側のパディングを増やす
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        display: false
      },
      title: {
        display: true,
        text: menuName,
        font: {
          size: isMobile ? 14 : 16
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        titleFont: {
          size: isMobile ? 12 : 14
        },
        bodyFont: {
          size: isMobile ? 12 : 14
        },
        callbacks: {
          title: (tooltipItems: TooltipItem<'line'>[]) => {
            // ツールチップのタイトルを日付形式に変換
            if (tooltipItems.length > 0 && tooltipItems[0].dataIndex !== undefined) {
              const dataIndex = tooltipItems[0].dataIndex;
              if (labels[dataIndex]) {
                return formatDate(labels[dataIndex], true); // ツールチップでは常に年月日を表示
              }
            }
            return '';
          },
          label: (tooltipItem: TooltipItem<'line'>) => {
            return `${tooltipItem.formattedValue} 円`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 10,
        displayColors: false
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            return value.toLocaleString() + '円';
          },
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      x: {
        ticks: {
          callback: getTicksCallback(),
          maxRotation: isMobile ? 45 : 0,
          minRotation: isMobile ? 45 : 0,
          font: {
            size: isMobile ? 9 : 11
          },
          autoSkip: false,
          align: 'start', // ラベルを左側に配置
        },
        grid: {
          display: false // X軸のグリッド線を非表示に
        }
      }
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  const chartData = {
    labels,
    datasets: [
      {
        data: data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }
    ]
  };

  return <Line options={options} data={chartData} />;
};

export const MetalPriceChart = () => {
  const { data, loading, error } = useMetalPriceHistory();
  const [period, setPeriod] = useState<PeriodKey>('1ヶ月');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (loading) {
    return <Box className="responsive-container responsive-text">読み込み中...</Box>;
  }

  if (error) {
    return <Box className="responsive-container responsive-text" sx={{ color: 'error.main' }}>エラー: {error}</Box>;
  }

  const filteredData = data.slice(0, PERIODS[period]);
  // 日付データを取得し、新しい順に並べ替え
  const labels = filteredData.map(d => d.date).reverse();

  const createMetalData = (metal: 'Au' | 'Pt' | 'Pd' | 'Ag') => {
    let metalKey = '';
    switch(metal) {
      case 'Au':
        metalKey = 'au_retail_price';
        break;
      case 'Pt':
        metalKey = 'pt_retail_price';
        break;
      case 'Pd':
        metalKey = 'pd_retail_price';
        break;
      case 'Ag':
        metalKey = 'ag_retail_price';
        break;
    }
    const prices = filteredData
      .map(d => Number(d[metalKey as keyof PriceHistory]))
      .filter(price => !isNaN(price))
      .reverse();
    return prices;
  };

  return (
    <div className="responsive-container dashboard-component chart-container">
      <h1 className="responsive-heading mb-4">金属価格チャート</h1>
      <Tabs 
        value={period} 
        onChange={(_, newValue) => setPeriod(newValue)}
        variant={isMobile ? "scrollable" : "standard"}
        scrollButtons={isMobile ? "auto" : false}
        sx={{ mb: 2 }}
      >
        {Object.keys(PERIODS).map(p => (
          <Tab 
            key={p} 
            label={p} 
            value={p} 
            sx={{ 
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              padding: isMobile ? '6px 8px' : '12px 16px'
            }}
          />
        ))}
      </Tabs>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={12} md={6}>
          <Box className="responsive-card" sx={{ height: isMobile ? '250px' : '300px', bgcolor: 'background.paper' }}>
            <LineChart 
              labels={labels}
              menuName="Au (金)"
              data={createMetalData('Au')}
              color="gold"
              period={period}
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <Box className="responsive-card" sx={{ height: isMobile ? '250px' : '300px', bgcolor: 'background.paper' }}>
            <LineChart 
              labels={labels}
              menuName="Pd (パラジウム)"
              data={createMetalData('Pd')}
              color="blue"
              period={period}
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <Box className="responsive-card" sx={{ height: isMobile ? '250px' : '300px', bgcolor: 'background.paper' }}>
            <LineChart 
              labels={labels}
              menuName="Ag (銀)"
              data={createMetalData('Ag')}
              color="gray"
              period={period}
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <Box className="responsive-card" sx={{ height: isMobile ? '250px' : '300px', bgcolor: 'background.paper' }}>
            <LineChart 
              labels={labels}
              menuName="Pt (プラチナ)"
              data={createMetalData('Pt')}
              color="silver"
              period={period}
            />
          </Box>
        </Grid>
      </Grid>
      {isMobile && (
        <p className="text-center text-gray-500 text-sm mt-4">
          グラフをタップすると日付ごとの価格が表示されます
        </p>
      )}
    </div>
  );
};