# WXM Data Fetch

## Install
- In the root of the project run `npm install`

## Usage
```
node ./src/index.js --help

Retrieves WXM data CIDs from basin with optional time range filtering 

Options

--mode string   Can be "full" to fetch the entire set of CIDs or "range" to   
                fetch CIDs for data in a specific day range                   
--from string   Ignore unless the mode is "range". The day from which to      
                fetch data (eg. 2023_10_15)                                   
--to string     Ignore unless the mode is "range". The day up to which to     
                fetch data (eg. 2023_10_15)  
```

### Example usage
```
node ./src/index.js --mode full
```
```
node ./index.js --mode range --from 2023_10_10 --to 2023_10_20
```