<template>
  <div class="container">
    <h1 class="mb-3">Spintax Checker</h1>
    <p class="text-muted mb-4">
      Use this tool to check your spintax variants to ensure all outputs that are going to be in your emails make sense.
    </p>

    <div class="mb-3 shadow">
      <textarea
        id="spintax-input"
        v-model="spintaxInput"
        @input="adjustHeight"
        class="form-control fw-bold"
        rows="5"
        placeholder="Enter your spintax here..."
        style="overflow: hidden; resize: none;"
      ></textarea>
    </div>

    <div class="slider-container">
      <div class="slider-wrapper d-flex align-items-center">
        <label for="results-slider" class="fw-bold me-2">How many results?</label>
        <div class="slider-wrapper">
          <input
            type="range"
            id="results-slider"
            class="form-range custom-slider"
            :min="Constants.MIN_RESULTS"
            :max="Constants.MAX_RESULTS"
            v-model="resultsCount"
            @input="updateSliderValue"
          />
        </div>
        <div id="slider-value" class="slider-value ms-2">{{ displayResultsCount }}</div>
      </div>
    </div>

    <div class="text-center mb-2">
      <button @click="generateResults" class="fw-bold btn btn-primary generate-btn">
        Generate ⚡
      </button>
    </div>

    <p v-if="noData" class="text-danger">{{ errorMessage }}</p>

    <div class="results" v-if="errorMessage && !noData && !duplicate">
      <h2>Results</h2>
      <p class="text-danger">{{ errorMessage }}</p>
    </div>

    <div class="results" v-if="errorMessage && duplicate">
      <h2>Results</h2>
      <p class="text-danger">{{ errorMessage }}</p>
    </div>
    
    <div class="results" v-if="results.length > 0">
      <h2>Results</h2>
      <p v-if="!lessData">Check out the Spintax variations below <span>👇</span></p>
      <p v-if="lessData">We've generated all possible variations of the spintax in the text box above 😄.</p>
      <ul class="results-list">
        <li v-for="(result, index) in results" :key="index">
          <span class="index">{{ index + 1 }}.</span> 
          {{ result }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { spintaxListStore } from '@/store/spintaxStore.js';
import { ref, computed } from 'vue';
import axios from 'axios';
import { Constants } from '@/constants.js'

const store = spintaxListStore();
const spintaxInput = ref("");
const resultsCount = ref(Constants.DEFAULT_RESULTS_COUNT);
const results = ref([]);
const errorMessage = ref("");
const maxValue = ref(20);
const noData = ref(false)
const lessData = ref(false)
const duplicate = ref(false)

const displayResultsCount = computed(() => {
  return resultsCount.value === '20' ? 'All' : resultsCount.value;
});

const adjustHeight = (event) => {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const processSpintax = (input) => {
  const randomPattern = /\{\{RANDOM\|([^{}]+)\}\}/g;
  function recursiveReplace(str) {
    const hasRandom = randomPattern.test(str);
    if (!hasRandom) {
      return str;
    }
    const processedStr = str.replace(randomPattern, (match, options) => {
      const optionsArray = options.split('|').map(option => option.trim());
      return `{${optionsArray.join('|')}}`;
    });
    return recursiveReplace(processedStr);
  }
  return recursiveReplace(input);
}

const generateResults = async () => {
  console.log(Constants.DEFAULT_RESULTS_COUNT)
  results.value = [];
  errorMessage.value = "";
  noData.value = false;
  lessData.value = false;
  duplicate.value = false;

  // Check if the input is empty
  if (!spintaxInput.value.trim()) {
    noData.value = true;
    errorMessage.value = "Please enter spintax to generate results.";
    return;
  }

  store.addSpintax(spintaxInput.value);

  const spintaxPattern = /\{([^{}]+)\}|\{\{RANDOM\|([^{}]+)\}\}/g;
  const hasSpintaxBlocks = spintaxPattern.test(spintaxInput.value);

  if (!hasSpintaxBlocks) {
    errorMessage.value = "There was no spintax to generate 🤔";
    store.clearSpintax();
    results.value = [];
    return;
  }

  const simpleSpintaxPattern = /\{([^{}]+)\}/g;
  const randomSpintaxPattern = /\{\{RANDOM\|([^{}]+)\}\}/g;

  const hasSimpleSpintax = simpleSpintaxPattern.test(spintaxInput.value);
  const hasRandomSpintax = randomSpintaxPattern.test(spintaxInput.value);

  if (hasSimpleSpintax && hasRandomSpintax) {
    duplicate.value = true
    errorMessage.value = "⚠️ Warning: you have used multiple different types of spintax, usually outreach tools only let you use one type of spintax at a time. For example it's either {like this|structured in this way} or {{RANDOM|structured like this|formatted like this}} but not both.";
    return;
  }

  let openCount = 0;
  let closeCount = 0;
  const stack = [];
  const unmatchedPositions = [];

  for (let i = 0; i < spintaxInput.value.length; i++) {
    const char = spintaxInput.value[i];
    if (char === '{') {
      openCount++;
      stack.push(i);
    } else if (char === '}') {
      closeCount++;
      if (stack.length > 0) {
        stack.pop();
      } else {
        unmatchedPositions.push(i);
      }
    }
  }

  if (openCount > closeCount) {
    unmatchedPositions.push(...stack);
  }

  if (unmatchedPositions.length > 0) {
    errorMessage.value = "D’oh! There was an issue with your spintax, check the red and underlined text above 👆";
    results.value = [];
    store.clearSpintax();
    return;
  }

  const duplicateWarning = checkForDuplicateOptions(spintaxInput.value);
  if (duplicateWarning) {
    duplicate.value = true
    errorMessage.value = "FYI: At least one of your spintax blocks has the same variable twice.";
    store.clearSpintax();
    return;
  }

  const payload = {
    userInput: processSpintax(spintaxInput.value),
    number: Number(resultsCount.value)
  };

  try {
    const response = await axios.post(Constants.API_BASE_URL, payload);
    results.value = response.data;
    if (results.value.length < Number(resultsCount.value)) {
      lessData.value = true;
    }
  } catch (error) {
    console.error('Error sending data:', error);
    store.clearSpintax();
    errorMessage.value = "An error occurred while generating results.";
  }
};


const checkForDuplicateOptions = (input) => {
  const spintaxBlocks = input.match(/\{([^{}]+)\}/g);
  if (!spintaxBlocks) return false;

  for (const block of spintaxBlocks) {
    const options = block.slice(1, -1).split('|');
    const uniqueOptions = new Set(options);
    if (uniqueOptions.size < options.length) {
      return true;
    }
  }
  return false;
};

const updateSliderValue = () => {
  console.log('Current results count:', resultsCount.value);
};
</script>

<style scoped>
body {
  background-color: #f4f8fb;
  font-family: "Roboto";
}

.container {
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  padding: 30px;
  margin-top: 50px;
}

.generate-btn {
  font-size: 14px;
  width: 200px;
  text-align: center;
  border-radius: 14px;
  background-color: #0096FF;
}

textarea {
  border-radius: 0px;
}

.results {
  margin-top: 20px;
}

.results h2 {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.results p {
  margin-bottom: 20px;
  font-size: 16px;
}

.results-list {
  list-style-type: none;
  padding: 0;
}

.custom-slider {
  width: 50px;
}

.results-list li {
  background-color: #f9f9f9;
  padding: 10px;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
}

.results-list li span {
  flex: 0 0 auto;
  white-space: nowrap;
}

.results-list li .result-text {
  flex: 1;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

.index {
  font-size: 18px;
  margin-right: 8px;
}

.error-message {
  color: red;
}

.slider-container {
  width: 100%;
  padding-bottom: 10px;
}

.slider-wrapper {
  display: flex;
  align-items: center; 
  width: 100%;
  flex-wrap: nowrap;
  position: relative;
}

.slider-thumb-value {
  position: absolute;
  top: -30px;
  left: calc(50% - 10px);
  background-color: #f6d655;
  border-radius: 10px;
  padding: 2px 5px;
  font-size: 12px;
  font-weight: bold;
  color: #000;
  transform: translateX(-50%);
  pointer-events: none;
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 5px;
  background: transparent;
}

input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    #0096FF,
    #0096FF 20px,
    transparent 4px,
    transparent 24px
  );
  border-radius: 5px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #f6d655;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -8px;
}

input[type="range"]::-moz-range-track {
  width: 100%;
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    #0096FF,
    #0096FF 20px,
    transparent 0px,
    transparent 24px
  );
  border-radius: 5px;
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #f6d655;
  border-radius: 50%;
  cursor: pointer;
}

.slider-value {
  font-size: 12px;
  font-weight: bold;
}

.slider-wrapper > label {
  flex: 0 0 15%;
}

.slider-wrapper > .slider-value {
  flex: 0 0 3%;
  text-align: right;
}
</style>
