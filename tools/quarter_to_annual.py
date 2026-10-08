#!/usr/bin/env python3
import os
import pandas as pd
import re
from pathlib import Path

def get_data_types(files):
    """Extract unique data types from filenames."""
    data_types = set()
    for file in files:
        # Extract the data type from the filename (e.g., 'class', 'src_income', etc.)
        match = re.match(r'\d{4}q[1-4]_(.*?)-Table 1\.csv', file)
        if match:
            data_type = match.group(1)
            data_types.add(data_type)
    return data_types

def get_quarter_files(year_dir, data_type):
    """Get all quarterly files for a specific data type in a year directory."""
    quarter_files = []
    for q in range(1, 5):
        file_pattern = f"{os.path.basename(year_dir)}q{q}_{data_type}-Table 1.csv"
        file_path = os.path.join(year_dir, file_pattern)
        if os.path.exists(file_path):
            quarter_files.append(file_path)
    return quarter_files

def combine_quarterly_files(quarter_files, output_file):
    """Combine multiple quarterly CSV files into a single annual file."""
    if not quarter_files:
        return False
    
    # Read and combine all quarterly files
    dfs = []
    for file in quarter_files:
        try:
            df = pd.read_csv(file)
            dfs.append(df)
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    if not dfs:
        return False
    
    # Combine all dataframes
    combined_df = pd.concat(dfs, ignore_index=True)
    
    # Write to the output file
    try:
        combined_df.to_csv(output_file, index=False)
        return True
    except Exception as e:
        print(f"Error writing {output_file}: {e}")
        return False

def main():
    # Path to the historic data directory
    historic_dir = Path("src/data/historic")
    
    # Process each year directory
    for year_dir in historic_dir.iterdir():
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        
        print(f"Processing year: {year_dir.name}")
        
        # Get all CSV files in the year directory
        csv_files = [f for f in os.listdir(year_dir) if f.endswith('.csv')]
        
        # Get unique data types
        data_types = get_data_types(csv_files)
        
        # Process each data type
        for data_type in data_types:
            # Get all quarterly files for this data type
            quarter_files = get_quarter_files(year_dir, data_type)
            
            if quarter_files:
                # Create output filename
                output_file = os.path.join(year_dir, f"{year_dir.name}_{data_type}.csv")
                
                # Combine the files
                success = combine_quarterly_files(quarter_files, output_file)
                
                if success:
                    print(f"  Created: {output_file}")
                else:
                    print(f"  Failed to create: {output_file}")

if __name__ == "__main__":
    main()
