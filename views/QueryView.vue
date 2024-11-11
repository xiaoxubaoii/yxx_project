<template>
  <div class="container">
    <!-- 输入搜索框 -->
    <a-input-search
            v-model="newTodo.value"
            placeholder="请输入您要查询的问题"
            enter-button="查询"
            size="large"
            @search="onSearch"
            class="header-container"
    />

    <!-- 加载中提示 -->
    <a-spin :spinning="isSpinning.value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></a-spin>

    <!-- 表格和图表切换 -->
    <div class="content-switcher" v-if="!isSpinning.value && dataSource.value.length > 0">
      <div v-if="viewType.value === 'table'" class="table-container">
        <a-table :data-source="dataSource.value" :columns="columns.value" class="table-div" />
      </div>
      <div v-else class="chart-container" :style="{ backgroundColor: '#f0f0f0' }">
        <div class="charts-container">
          <!-- 选择器 -->
          <select v-model="selectedColumn.value" @change="updateCharts">
            <option v-for="column in columns.value" :key="column.dataIndex" :value="column.dataIndex">{{ column.title }}</option>
          </select>

          <!-- 柱状图容器 -->
          <div ref="barChartRef" class="chart-container" style="height: 400px;"></div>

          <!-- 包含两个饼图的容器 -->
          <div class="charts-row">
            <!-- 按横轴统计总数的饼图容器 -->
            <div ref="byLocationPieChartRef" class="chart-container" style="width: 48%;">
              <div ref="locationChartDiv" class="chart" style="height: 400px;"></div>
            </div>

            <!-- 按图例统计总数的饼图容器 -->
            <div ref="byLegendPieChartRef" class="chart-container" style="width: 48%;">
              <div ref="legendChartDiv" class="chart" style="height: 400px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 可视化/表格切换按钮 -->
    <div class="toggle-button-container" v-if="!isSpinning.value && dataSource.value.length > 0">
      <a-button v-if="viewType.value === 'table'" @click="toggleView('charts')" class="toggle-button">
        可视化
      </a-button>
      <a-button v-else @click="toggleView('table')" class="toggle-button">
        表格
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Input, Button, TableColumnsType, Spin } from 'ant-design-vue';
import * as echarts from 'echarts';
import axios from 'axios';

// 当前选定的列名
const selectedColumn = ref('');

// 初始化图表容器引用
const barChartRef = ref(null);
const locationChartDiv = ref(null);
const legendChartDiv = ref(null);

// 初始化数据源和列
const dataSource = ref([]); // 数据源
const columns = ref([]); // 列定义

// 初始化柱状图
const initBarChart = (xData, seriesData) => {
  const chart = echarts.init(barChartRef.value);
  const option = {
    legend: {
      data: seriesData.map(series => series.name),
      top: '0%',
      textStyle: {
        color: '#333'
      },
      selectedMode: 'multiple'
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        interval: 0,
        rotate: -45,
      },
      axisTick: {
        alignWithLabel: true,
      },
    },
    yAxis: {
      type: 'value',
    },
    series: seriesData.map(series => ({
      name: series.name,
      type: 'bar',
      data: series.data,
      itemStyle: {
        normal: {
          color: getUniqueColor(seriesData.indexOf(series)),
        },
      },
    })),
  };
  chart.setOption(option);
  return chart;
};

// 初始化按横轴统计总数的饼图
const initLocationPieChart = (totals) => {
  const chart = echarts.init(locationChartDiv.value);
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)',
    },
    legend: {
      data: Object.keys(totals),
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: '#333',
      },
      formatter: (name) => {
        const index = Object.keys(totals).findIndex(label => label === name);
        return `${name}: ${totals[name]}`;
      },
    },
    series: [
      {
        name: 'Total by Location',
        type: 'pie',
        radius: '75%',
        center: ['50%', '50%'],
        data: Object.keys(totals).map(key => ({
          value: totals[key],
          name: key,
        })),
      },
    ],
  };
  chart.setOption(option);
  return chart;
};

// 初始化按图例统计总数的饼图
const initLegendPieChart = (totals) => {
  const chart = echarts.init(legendChartDiv.value);
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)',
    },
    legend: {
      data: Object.keys(totals),
      orient: 'vertical',
      right: 'right',
      textStyle: {
        color: '#333',
      },
      formatter: (name) => {
        const index = Object.keys(totals).findIndex(label => label === name);
        return `${name}: ${totals[name]}`;
      },
    },
    series: [
      {
        name: 'Total by Legend',
        type: 'pie',
        radius: '75%',
        center: ['50%', '50%'],
        data: Object.keys(totals).map(key => ({
          value: totals[key],
          name: key,
        })),
      },
    ],
  };
  chart.setOption(option);
  return chart;
};

// 获取唯一颜色
const getUniqueColor = (index) => {
  const colors = ['#5793f3', '#d14a61', '#675bba', '#e0c239', '#37a2da'];
  return colors[index % colors.length];
};

// 根据选定的列名准备数据
const prepareDataForSelectedColumn = (columns, dataSource, selectedColumn) => {
  const xData = dataSource.value.map(item => item[selectedColumn.value]); // 使用选定列作为X轴数据
  const seriesData = columns.value.filter(column =>
    typeof dataSource.value[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year' && column.dataIndex !== selectedColumn.value
  ).map(column => ({
    name: column.title,
    data: dataSource.value.map(item => item[column.dataIndex])
  }));

  return { xData, seriesData };
};

// 计算按横轴统计总数
const getLocationTotals = (columns, dataSource, selectedColumn) => {
  const totals = {};
  dataSource.value.forEach(item => {
    const value = item[selectedColumn.value];
    totals[value] = totals[value] || 0;
    columns.value.filter(column => typeof dataSource.value[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year' && column.dataIndex !== selectedColumn.value).forEach(column => {
      totals[value] += item[column.dataIndex];
    });
  });
  return totals;
};

// 计算按图例统计总数
const getLegendTotals = (dataSource) => {
  const totals = {};
  columns.value.filter(column => typeof dataSource.value[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year').forEach(column => {
    totals[column.title] = dataSource.value.reduce((acc, cur) => acc + cur[column.dataIndex], 0);
  });
  return totals;
};

// 监听选择器变化并更新图表
const updateCharts = () => {
  if (!barChartRef.value || !locationChartDiv.value || !legendChartDiv.value) return;

  // 使用转换后的数据
  const { xData, seriesData } = prepareDataForSelectedColumn(columns.value, dataSource.value, selectedColumn.value);
  initBarChart(xData, seriesData);
  initLocationPieChart(getLocationTotals(columns.value, dataSource.value, selectedColumn.value));
  initLegendPieChart(getLegendTotals(dataSource.value));
};

// 在组件挂载完成后初始化图表
onMounted(() => {
  updateCharts();
});

const newTodo = ref('');
const viewType = ref('table'); // 默认为表格视图
const db_id = ref('perpetrator');
const isSpinning = ref(false); // 控制加载动画

const onSearch = (value) => {
  if (typeof value === 'undefined' || value.trim() === '') {
    alert('问题不能为空');
    return;
  }

  isSpinning.value = true;

  axios.post('http://127.0.0.1:5000/axios', { 'question': value, 'db_id': db_id.value })
    .then(response => {
      isSpinning.value = false;

      if (response.data[0].length === 0) {
        alert('当前查询不可回答');
        resetState();
        return;
      }

      // 更新响应式数据
      dataSource.value = response.data[0] || [];
      columns.value = response.data[1] || [];

      console.log("后端返回成功", response.data[0]);
      console.log("后端返回成功", response.data[1]);

      // 更新选定的列名
      selectedColumn.value = columns.value[0]?.dataIndex || '';

      // 切换到图表视图
      viewType.value = 'charts';
    })
    .catch(() => {
      // 处理网络请求错误
      isSpinning.value = false;
      alert('服务器没有响应');
      resetState();
    });
};

const toggleView = (type) => {
  if (type === 'table') {
    // 切换回表格视图
    viewType.value = 'table';
  } else {
    // 当切换到图表视图时，重新创建图表
    viewType.value = 'charts';
    updateCharts();
  }
};

const resetState = () => {
  viewType.value = 'table';
  dataSource.value = [];
  columns.value = [];
  selectedColumn.value = '';
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  position: relative;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60%;
  margin-top: 20vh;
  box-sizing: border-box;
}

.content-switcher {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
}

.table-container {
  margin-top: 5vh;
  width: 60%;
  box-sizing: border-box;
}

.table-div {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.chart-container {
  width: 60%;
  display: flex;
  flex-direction: row;
  gap: 20px;
  background-color: #f0f0f0; /* 添加背景颜色 */
}

.charts-row {
  display: flex;
  flex-direction: row;
  gap: 20px;
}

.toggle-button-container {
  position: absolute;
  right: 5%; /* 距离浏览器右侧边缘5% */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.toggle-button {
  margin: 10px 0;
  width: auto; /* 让宽度自适应内容 */
  background-color: #1890ff;
  border: none;
  color: white;
  font-size: 16px;
  padding: 12px 24px; /* 增加padding以使按钮稍微大于文字 */
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s ease;
  display: flex; /* 使用flex布局 */
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  text-align: center; /* 确保文本在内部也居中 */
}

.toggle-button:hover {
  background-color: #0050b3;
}

.charts-container {
  width: 60%;
  margin: auto;
}

.chart-container {
  margin-bottom: 20px;
  background-color: #f0f0f0;
  padding: 10px;
  position: relative;
}
</style>