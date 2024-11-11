<template>
  <div class="container">
    <!-- 输入搜索框 -->
    <a-input-search
            v-model="newTodo"
            placeholder="请输入您要查询的问题"
            enter-button="查询"
            size="large"
            @search="onSearch"
            class="header-container"
    />

    <!-- 加载中提示 -->
    <a-spin :spinning="isSpinning" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></a-spin>

    <!-- 查询完成，结果不为空，展示 -->
    <div class="content-switcher" v-if="!isSpinning && dataSource.length > 0">
      <!-- 表格展示 -->
      <div v-if="viewType === 'table'" class="table-container">
        <a-table :data-source="dataSource" :columns="columns" class="table-div" />
      </div>

      <!-- 可视化展示 -->
      <div v-else class="charts-container">
        <!-- 选择器 -->
        <select v-model="selectedColumn" @change="updateCharts">
          <option v-for="column in columns" :key="column.key" :value="column.key">{{ column.title }}</option>
        </select>

        <!-- 柱状图容器 -->
        <div ref="barChartRef" style="height: 400px;" id="barChartRef" class="bar-chart-container"></div>

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

    <!-- 可视化/表格切换按钮 -->
    <div class="toggle-button-container" v-if="!isSpinning && dataSource.length > 0">
      <a-button v-if="viewType === 'table'" @click="toggleView('view')" class="toggle-button">
        可视化
      </a-button>
      <a-button v-else @click="toggleView('table')" class="toggle-button">
        表格
      </a-button>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, nextTick } from 'vue';
  import { Input, Button, TableColumnsType, Spin, Select } from 'ant-design-vue';
  import * as echarts from 'echarts';
  import { use } from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import { LineChart } from 'echarts/charts';
  //import * as echarts from 'echarts';
  import { GridComponent, TooltipComponent } from 'echarts/components';
  import axios from 'axios';

  // 注册必须的组件
  use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);
const newTodo = ref('');
const viewType = ref('table'); // 默认为表格视图
const db_id = ref('perpetrator');
const isSpinning = ref(false); // 控制加载动画
const selectedColumn = ref(null);
const barChartRef = ref(null);
const locationChartDiv = ref(null);
const legendChartDiv = ref(null);
const dataSource = ref([]);
const columns = ref([]);

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

const getUniqueColor = (index) => {
  const colors = ['#5793f3', '#d14a61', '#675bba', '#e0c239', '#37a2da'];
  return colors[index % colors.length];
};

const prepareDataForSelectedColumn = (columns, dataSource, selectedColumn) => {
  const xData = dataSource.map(item => item[selectedColumn]); // 使用选定列作为X轴数据
  const seriesData = columns.filter(column =>
    typeof dataSource[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year' && column.dataIndex !== selectedColumn
  ).map(column => ({
    name: column.title,
    data: dataSource.map(item => item[column.dataIndex])
  }));

  return { xData, seriesData };
};

const getLocationTotals = (columns, dataSource, selectedColumn) => {
  const totals = {};
  dataSource.forEach(item => {
    const value = item[selectedColumn];
    totals[value] = totals[value] || 0;
    columns.filter(column => typeof dataSource[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year' && column.dataIndex !== selectedColumn).forEach(column => {
      totals[value] += item[column.dataIndex];
    });
  });
  return totals;
};

const getLegendTotals = (dataSource) => {
  const totals = {};
  columns.value.filter(column => typeof dataSource[0][column.dataIndex] === 'number' && !column.dataIndex.includes('ID') && column.dataIndex !== 'Year').forEach(column => {
    totals[column.title] = dataSource.reduce((acc, cur) => acc + cur[column.dataIndex], 0);
  });
  return totals;
};

const updateCharts = () => {
  // 确保元素已存在
  if (!barChartRef.value || !locationChartDiv.value || !legendChartDiv.value) return;

  // 使用转换后的数据
  const { xData, seriesData } = prepareDataForSelectedColumn(columns.value, dataSource.value, selectedColumn.value);
  initBarChart(xData, seriesData);
  initLocationPieChart(getLocationTotals(columns.value, dataSource.value, selectedColumn.value));
  initLegendPieChart(getLegendTotals(dataSource.value));
};

const toggleView = (type) => {
  if (type === 'table') {
    // 切换回表格视图
    viewType.value = 'table';
  } else {
    // 切换到图表视图
    viewType.value = 'view';

    // 使用 nextTick 确保 DOM 更新完成后再初始化图表
    nextTick(() => {
      if (!selectedColumn.value) {
        selectedColumn.value = columns.value[0].key;
      }
      updateCharts();
    });
  }
};

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
        alert('抱歉，无法回答您的问题，请换个方式提问。');
        resetState();
        return;
      }

      // 更新响应式数据
      dataSource.value = response.data[0];
      columns.value = response.data[1];
      selectedColumn.value = columns.value[0].key;
      updateCharts(); // 在数据加载后立即更新图表
    })
    .catch(error => {
        isSpinning.value = false;
        console.error('请求失败:', error);
        alert('服务器没有响应');
        resetState();
      });
};

const resetState = () => {
  viewType.value = 'table';
  dataSource.value = [];
  columns.value = [];
};

onMounted(() => {
  // 在组件挂载完成后初始化图表
  if (viewType.value === 'view') {
    updateCharts();
  }
});
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

.selectors {
  display: flex;
  align-items: center;
  gap: 10px; /* 选择器之间的间距 */
  margin-top: 20px;
}

.selector-prompt {
  font-size: 18px;
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

.charts-row {
  display: flex;
  justify-content: space-between;
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
</style>