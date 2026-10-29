-- Table definitions (no data) from NYPL ppd.db, used to check that
-- SQL generated for captured real-world requests is valid on the real schema.

CREATE TABLE `main` (
  `Object_ID` INTEGER NOT NULL PRIMARY KEY,
  `Department` TEXT NOT NULL,
  `Object_Number` TEXT NOT NULL,
  `Title` TEXT,
  `Display_Name` TEXT,
  `Classification` TEXT,
  `Role` TEXT,
  `First_Name` TEXT,
  `Last_Name` TEXT,
  `Medium` TEXT,
  `Dated` TEXT,
  `Display_Date` TEXT,
  `Nationality` TEXT,
  `Dimensions` TEXT,
  `Catalogue_Raisonne` TEXT,
  `Call_Number` TEXT,
  `Home_Location` TEXT,
  `Status_Flag` TEXT,
  `Object_Count` INTEGER NOT NULL,
  `Begin_Date` INTEGER,
  `End_Date` INTEGER,
  `Value` REAL,
  `Geo_Search_Value` TEXT,
  `Collection` TEXT,
  `Series` TEXT,
  `Portfolio` TEXT,
  `Descriptive_Title` TEXT,
  `Folder` TEXT,
  `Depicted_Location` TEXT,
  `Non_Display_Title` TEXT,
  `Book_or_Album_Title` TEXT,
  `Link` TEXT,
  `Institution` TEXT,
  `After` TEXT,
  `Explicit_Artist` TEXT,
  `Compiler` TEXT,
  `Editor` TEXT,
  `Photographer` TEXT,
  `Printer` TEXT,
  `Printmaker` TEXT,
  `Publisher` TEXT,
  `Sponsor` TEXT,
  `Subject` TEXT,
  `Country` TEXT,
  `State` TEXT,
  `County` TEXT,
  `City` TEXT,
  `Locus` TEXT,
  `Signed` TEXT,
  `Inscribed` TEXT,
  `Markings` TEXT,
  `Credit_Line` TEXT,
  `Chat` TEXT,
  `Description` TEXT,
  `Notes` TEXT,
  `Provenance` TEXT,
  `Pub_References` TEXT,
  `Curatorial_Remarks` TEXT,
  `Related_Works` TEXT,
  `Public_Access` INTEGER,
  `Paper_File_Ref` TEXT,
  `User_Number1` TEXT,
  `Object_State` TEXT,
  `Hist_Attributions` TEXT,
  `Bibliography` TEXT,
  `Edition` TEXT,
  `Paper_Support` TEXT,
  `Is_Template` INTEGER NOT NULL,
  `Date_Remarks` TEXT
) STRICT, WITHOUT ROWID;

CREATE TABLE `constituents` (
  `Constituent_ID` INTEGER NOT NULL PRIMARY KEY,
  `Display_Name` TEXT NOT NULL,
  `Display_Date` TEXT,
  `Name_Title` TEXT,
  `First_Name` TEXT,
  `Last_Name` TEXT,
  `Suffix` TEXT,
  `Institution` TEXT,
  `Begin_Date` INTEGER NOT NULL,
  `End_Date` INTEGER NOT NULL,
  `Nationality` TEXT,
  `Alt_Names` TEXT
) STRICT, WITHOUT ROWID;

CREATE TABLE `exhibitions` (
  `Exhibition_ID` INTEGER NOT NULL PRIMARY KEY,
  `Department` TEXT NOT NULL,
  `Title` TEXT NOT NULL,
  `Abbreviation` TEXT,
  `Boiler_Text` TEXT,
  `Begin_Year` INTEGER NOT NULL,
  `End_Year` INTEGER NOT NULL,
  `Display_Date` TEXT,
  `Remarks` TEXT,
  `Project_Number` TEXT,
  `Citation` TEXT,
  `Organization_Credit_Line` TEXT,
  `Sponsor_Credit_Line` TEXT,
  `Sub_Title` TEXT,
  `Is_In_House` INTEGER NOT NULL,
  `Is_Virtual` INTEGER
) STRICT, WITHOUT ROWID;

CREATE VIRTUAL TABLE ftglobal USING fts5(
  Title, Display_Name, First_Name, Last_Name, Medium, Display_Date, Catalogue_Raisonne, Call_Number, Geo_Search_Value, Collection, Series, Portfolio, Descriptive_Title, Folder, Depicted_Location, Non_Display_Title, Book_or_Album_Title, Institution, After, Explicit_Artist, Compiler, Editor, Photographer, Printer, Printmaker, Publisher, Sponsor, Subject, content=main, content_rowid=Object_ID
);

CREATE VIRTUAL TABLE fttitles USING fts5(
  Title, Catalogue_Raisonne, Collection, Series, Portfolio, Descriptive_Title, Folder, Non_Display_Title, Book_or_Album_Title, content=main, content_rowid=Object_ID
);

CREATE VIRTUAL TABLE ftconstituents USING fts5(
  Display_Name, First_Name, Last_Name, Institution, After, Explicit_Artist, Compiler, Editor, Photographer, Printer, Printmaker, Publisher, Sponsor, content=main, content_rowid=Object_ID
);
