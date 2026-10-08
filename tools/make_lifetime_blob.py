#!/usr/bin/env python3
import os
import pandas as pd
import re
from pathlib import Path
import glob
import random
import numpy as np

def normalize_value(value):
    """Normalize a value for comparison, handling different number formats."""
    if pd.isna(value):
        return None
    
    # Convert to string and remove any commas and extra spaces
    str_val = str(value).replace(',', '').strip()
    
    try:
        # Try to convert to float for numeric comparison
        float_val = float(str_val)
        # Format small numbers consistently
        if abs(float_val) < 0.0001 and float_val != 0:
            return format(float_val, '.10f')
        # Format other numbers with consistent precision
        return format(float_val, '.2f')
    except (ValueError, TypeError):
        # If not a number, return the cleaned string
        return str_val

def normalize_row(row_dict):
    """Normalize all values in a row dictionary."""
    return {k: normalize_value(v) for k, v in row_dict.items()}

def rows_match(sample_row, combined_row):
    """Check if two rows match, being lenient with number formatting."""
    # Normalize both rows
    norm_sample = normalize_row(sample_row)
    norm_combined = normalize_row(combined_row)
    
    # Get common keys (columns) between the two rows
    common_keys = set(norm_sample.keys()) & set(norm_combined.keys())
    
    # Check each common column
    for key in common_keys:
        sample_val = norm_sample[key]
        combined_val = norm_combined[key]
        
        # Skip comparison if either value is None/NaN
        if sample_val is None or combined_val is None:
            continue
            
        # Values don't match
        if sample_val != combined_val:
            return False
    
    return True

def is_quarterly_file(filename):
    """Check if a file is a quarterly file."""
    # Quarterly files match pattern like 2024q1_class-Table 1.csv
    quarterly_pattern = r'^\d{4}q[1-4]_.*-Table 1\.csv$'
    return bool(re.match(quarterly_pattern, filename))

def get_data_type(filename):
    """Extract the data type from a quarterly filename."""
    match = re.match(r'^\d{4}q[1-4]_(.*?)-Table 1\.csv$', filename)
    if match:
        return match.group(1)
    return None

def combine_quarterly_files(historic_dir, output_dir):
    """Combine quarterly CSV files into lifetime blobs."""
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Dictionary to store dataframes by data type
    dataframes = {}
    
    # Dictionary to store file information for verification
    file_info = {}
    
    # Get all year directories
    year_dirs = [d for d in os.listdir(historic_dir) 
                 if os.path.isdir(os.path.join(historic_dir, d)) and d.isdigit()]
    
    # Process each year directory
    for year in sorted(year_dirs):
        year_path = os.path.join(historic_dir, year)
        print(f"Processing year: {year}")
        
        # Get all CSV files in the year directory
        csv_files = [f for f in os.listdir(year_path) if f.endswith('.csv')]
        
        # Filter for quarterly files
        quarterly_files = [f for f in csv_files if is_quarterly_file(f)]
        
        # Group quarterly files by data type
        quarterly_by_type = {}
        for file in quarterly_files:
            data_type = get_data_type(file)
            if data_type:
                if data_type not in quarterly_by_type:
                    quarterly_by_type[data_type] = []
                quarterly_by_type[data_type].append(file)
        
        # Process each data type's quarterly files
        for data_type, files in quarterly_by_type.items():
            print(f"  Processing {data_type} quarterly files:")
            
            # Sort files by quarter to ensure correct order
            files.sort()  # This will sort by year and quarter due to filename format
            
            for file in files:
                file_path = os.path.join(year_path, file)
                print(f"    Reading: {file}")
                
                try:
                    # Read the CSV file
                    df = pd.read_csv(file_path)
                    
                    # Store file information for verification
                    if data_type not in file_info:
                        file_info[data_type] = []
                    
                    # Take a sample of rows for verification
                    sample_size = min(3, len(df))
                    if sample_size > 0:
                        sample_indices = random.sample(range(len(df)), sample_size)
                        samples = df.iloc[sample_indices].to_dict('records')
                    else:
                        samples = []
                    
                    file_info[data_type].append({
                        'file': file_path,
                        'rows': len(df),
                        'sample_indices': sample_indices if sample_size > 0 else [],
                        'sample_data': samples
                    })
                    
                    # Add year and quarter columns if they don't exist
                    if 'year' not in df.columns:
                        df['year'] = year
                    quarter_match = re.search(r'q([1-4])', file)
                    if quarter_match and 'quarter' not in df.columns:
                        df['quarter'] = quarter_match.group(1)
                    
                    # Add to the appropriate dataframe
                    if data_type in dataframes:
                        dataframes[data_type] = pd.concat([dataframes[data_type], df], ignore_index=True)
                    else:
                        dataframes[data_type] = df
                        
                except Exception as e:
                    print(f"    Error processing {file}: {e}")
    
    # Write each combined dataframe to a lifetime CSV file
    for data_type, df in dataframes.items():
        output_file = os.path.join(output_dir, f"lifetime_{data_type}.csv")
        try:
            # Sort by year and quarter if they exist
            sort_columns = ['year']
            if 'quarter' in df.columns:
                sort_columns.append('quarter')
            df = df.sort_values(by=sort_columns)
            
            df.to_csv(output_file, index=False)
            print(f"\nCreated lifetime file: {output_file} with {len(df)} rows")
            
            # Verify the combined file
            verify_combined_file(data_type, file_info[data_type], df, output_file)
            
        except Exception as e:
            print(f"Error writing {output_file}: {e}")

def verify_combined_file(data_type, file_info_list, combined_df, output_file):
    """Verify that the combined file contains all data from the original files."""
    print(f"\nVerifying {data_type} data:")
    
    # Count total rows in original files
    total_original_rows = sum(info['rows'] for info in file_info_list)
    combined_rows = len(combined_df)
    
    print(f"  Total rows in original files: {total_original_rows}")
    print(f"  Rows in combined file: {combined_rows}")
    
    if total_original_rows == combined_rows:
        print(f"  ✓ Row count verification passed")
    else:
        print(f"  ✗ Row count verification failed! Missing {total_original_rows - combined_rows} rows")
    
    # Check for sample data from each file
    print(f"  Checking sample data from each file:")
    all_samples_found = True
    
    for info in file_info_list:
        file_name = os.path.basename(info['file'])
        samples = info['sample_data']
        
        if not samples:
            print(f"    {file_name}: No data to sample")
            continue
        
        samples_found = 0
        for sample in samples:
            # Check if this sample exists in the combined dataframe
            sample_found = False
            
            # Check each row in the combined dataframe
            for _, row in combined_df.iterrows():
                if rows_match(sample, row.to_dict()):
                    sample_found = True
                    samples_found += 1
                    break
            
            if not sample_found:
                print(f"    ✗ Sample from {file_name} not found in combined file")
                print(f"      Sample values: {normalize_row(sample)}")
                all_samples_found = False
        
        if samples_found == len(samples):
            print(f"    ✓ All {samples_found} samples from {file_name} found in combined file")
        else:
            print(f"    ✗ Only {samples_found}/{len(samples)} samples from {file_name} found in combined file")
            all_samples_found = False
    
    if all_samples_found:
        print(f"  ✓ Sample data verification passed")
    else:
        print(f"  ✗ Sample data verification failed!")
    
    print(f"  Verification complete for {data_type}")

def main():
    # Path to the historic data directory
    historic_dir = Path("src/data/historic")
    
    # Path to the output directory for lifetime files
    output_dir = Path("src/data/historic/lifetime")
    
    # Combine quarterly files into lifetime blobs
    combine_quarterly_files(historic_dir, output_dir)
    
    print("\nLifetime blob creation complete!")

if __name__ == "__main__":
    main()
